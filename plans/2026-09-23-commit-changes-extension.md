# Plan: `commit-changes` Pi extension

Date: 2026-09-23 · Status: ready to implement (decisions Q1–Q3 resolved)

## Context

Pi (installed: `@earendil-works/pi-coding-agent` 0.87.1) gains custom capabilities through **extensions**. This repo already ships 8 single-file extensions in `.pi/extensions/` (e.g. `git-staged-changes.ts`, `current-date.ts`), auto-discovered by Pi at startup (`.pi/extensions/*.ts` → default-export factory → `pi.registerTool(...)`), with zero install/build step.

We want a `commit_changes` tool that the model can call to stage everything and create exactly one commit: `git add . && git commit -m <message>`. Hard requirements from the user:

- Exactly one tool `commit_changes` with a string parameter `message`.
- The tool runs **exactly** `git add .` and `git commit -m <message>` — no other flags on either command.
- The `message` value originates from the model, so it must flow to git with no shell interpolation and no flag smuggling.

Security/robustness drivers:

- `pi.exec(command, args, opts)` uses `spawn(..., { shell: false })` → **argv array, no shell involved** → `$(...)`, backticks, `;`, `&&` in the message are inert; the message arrives at git as one opaque token. Git's option parser consumes the token after `-m` verbatim as the message value (even a leading `-`), so no flag can be smuggled through the message.
- Repo git hooks will run on every commit: `.husky/pre-commit` → `npx lint-staged` (runs turbo lint + npm format on staged `(apps|packages)/**` files — slow, may modify files) and `.husky/commit-msg` → `npm run commitlint` (enforces Conventional Commits: lower-case start, type in `[build, ci, chore, docs, feat, fix, perf, refactor, revert, style, test]`). A free-form model message will frequently fail the commit. Mitigation is content-level (tool description/prompt guidelines), **not** extra git flags.
- Lockdown (`@chrischow/pi-lockdown`) gates tool activation and permission: a custom tool is only active for the model if listed in `.pi/settings.json` `lockdown.customTools` (keys), otherwise it cannot be called; unlisted tools default to `warn` (and are hard-blocked in headless/subagent mode).

## Approach

Recommended approach: **single-file extension** `.pi/extensions/commit-changes.ts` (repo convention, auto-discovered, nothing to install), registered with the canonical repo shape (mirror `.pi/extensions/git-staged-changes.ts`), plus a lockdown settings update. Two `pi.exec` calls, argv-style, `-m` as the only flag.

Full implementation sketch:

```typescript
/**
 * Stages all changes (git add .) and creates a single commit with the exact
 * message provided. Message must be Conventional Commits (repo commit-msg hook).
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "commit_changes",
    label: "Commit Changes",
    description:
      "Stages all changes (git add .) and creates a single commit with the exact message provided. " +
      "Returns git's output and exit codes; failures (e.g. empty message, nothing staged, repo hook " +
      "rejections like commitlint or lint-staged) are reported in the result content, not thrown.",
    promptSnippet: "Stage all changes and create a git commit with the provided message",
    promptGuidelines: [
      "Use commit_changes to run 'git add . && git commit -m <msg>' in one step when the user asks to commit everything. " +
        "Repo hooks run on commit (pre-commit lint-staged, commit-msg commitlint); if a hook rejects the message, " +
        "report the rejection from the tool result and try again.",
    ],
    parameters: Type.Object({
      message: Type.String({
        description:
          "Commit message in Conventional Commits format, e.g. 'feat: add login form'. No other git flags are passed.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      // Probe git availability + find repo root (handles subdir launches & missing git).
      let repoRoot: string;
      try {
        const { code, stdout } = await pi.exec("git", ["rev-parse", "--show-toplevel"], { signal: ctx.signal });
        if (code !== 0) {
          return {
            content: [{ type: "text", text: "Not a git repository (or git is not installed)." }],
            details: { committed: false, commitHash: undefined, addCode: undefined, code },
          };
        }
        repoRoot = stdout.trim();
      } catch (err) {
        return {
          content: [{ type: "text", text: `Could not run git: ${err}` }],
          details: { committed: false, commitHash: undefined, addCode: undefined, code: undefined },
        };
      }

      const opts = { signal: ctx.signal, cwd: repoRoot };

      const add = await pi.exec("git", ["add", "."], opts);
      if (add.code !== 0) {
        return {
          content: [{ type: "text", text: `git add . failed (exit ${add.code}):\n${add.stderr}` }],
          details: { committed: false, commitHash: undefined, addCode: add.code, code: undefined },
        };
      }

      const commit = await pi.exec("git", ["commit", "-m", params.message], opts);
      const hashMatch = commit.stdout.match(/\[[^\]]*?([0-9a-f]{7,40})\]/);
      const commitHash = hashMatch ? hashMatch[1] : undefined;
      const committed = commit.code === 0;
      const text = committed
        ? `Committed${commitHash ? ` ${commitHash}` : ""}:\n${params.message}\n\n${commit.stdout.trim()}`
        : `git commit failed (exit ${commit.code}):\n${(commit.stderr || commit.stdout).trim()}`;

      return {
        content: [{ type: "text", text }],
        details: { committed, commitHash, addCode: add.code, code: commit.code },
      };
    },
  });
}
```

Design decisions in the sketch:

- **No flags beyond spec**: `["add", "."]` and `["commit", "-m", message]` are the only argv ever built; the only variable is the message value.
- **`cwd` = git top-level** (from the probe), so behavior is identical whether Pi launches at repo root or a subdirectory. The probe also guards the `spawn`-throw case when git is missing (repo's `git-staged-changes.ts` does the same).
- **Failures returned, not thrown**: expected git failures (`nothing to commit`, empty message, commitlint rejection) are surfaced as result content with git's `stderr` so the model can react — matches the repo's `git-staged-changes.ts` convention (`throw` only for genuine errors, and here even that is returned as text for robustness).
- **Description kept neutral (Q2)**: no format requirements in the tool description or guidelines. Failure output — including commit-msg hook (commitlint) and pre-commit hook errors — is surfaced verbatim as `stderr` in the result content so the model can react and retry. The handler never rewrites the user's message.
- **`details`** carry structured state (`committed`, `commitHash`, `addCode`, `code`) for UI rendering / state reconstruction per the tool result contract.

`.pi/settings.json` (lockdown). Add `commit_changes` under both `lockdown.customTools` and `lockdownSubagent.customTools` (else the model cannot call it; unlisted tools default to `warn` and are hard-blocked headless). **Decided (Q1): `"allow"` interactively, `"block"` for subagents** — mirrors the repo's existing `run_npm_script` treatment (write action); committing is a write action. Contrast `git_staged_changes` which is `allow`/`allow`.

## Files to modify

| Action | Path | Change |
|---|---|---|
| add | `.pi/extensions/commit-changes.ts` | New single-file extension (sketch above) |
| edit | `.pi/settings.json` | Add `"commit_changes": "allow"` to `lockdown.customTools` and `"commit_changes": "block"` to `lockdownSubagent.customTools` |

No changes to root `package.json`, turbo config, or any workspace — `.pi/` is outside `apps/*` / `packages/*` and is not covered by repo lint/format targets.

## Reuse

- `.pi/extensions/git-staged-changes.ts` — canonical template: `registerTool` shape, `import { Type } from "typebox"`, git probe pattern (`git rev-parse` → nonzero → friendly result), `pi.exec(..., { signal: ctx.signal })`, result `{ content: [...], details }`, snake_case name / Title Case label / `promptSnippet` + `promptGuidelines`.
- `pi.exec` from `ExtensionAPI` (`@earendil-works/pi-coding-agent` 0.87.1) — argv-based, `shell: false`, returns `{ stdout, stderr, code, killed }`.
- Official example `examples/extensions/auto-commit-on-exit.ts` — same `git commit -m <message>` argv pattern.
- Pi docs `docs/extensions.md` — tool `execute()` semantics ("Throw to produce a failed tool result; returning an object does not mark an error").
- `.husky/commit-msg` + `commitlint.config.js` — the message-format contract the tool must steer toward.
- `.agents/skills/write-commit-message/SKILL.md` — repo's own commit message guidance (Conventional Commits, lower-case, type list).

## Steps

- [ ] 1. Create `.pi/extensions/commit-changes.ts` with the sketch above (default-export factory → `pi.registerTool`).
- [ ] 2. Edit `.pi/settings.json`: add `"commit_changes": "allow"` to `lockdown.customTools` and `"commit_changes": "block"` to `lockdownSubagent.customTools`.
## Decisions (resolved with user, 2026-09-23)

- **Q1 — Lockdown policy**: `"allow"` interactively (`lockdown.customTools`), `"block"` for subagents (`lockdownSubagent.customTools`) — mirrors `run_npm_script`; committing is a write action.
- **Q2 — Message steering**: none. Tool description/guidelines stay neutral (no Conventional-Commits demands); commit failures — including commitlint/lint-staged hook rejections — are surfaced to the model via the result content (`stderr`) and the model retries.
- **Q3 — Testing/verification**: the user runs all testing and verification themselves — this plan deliberately contains no testing steps or verification checklist.

Plan is ready for execution via `.agents/skills/execute-plan`.