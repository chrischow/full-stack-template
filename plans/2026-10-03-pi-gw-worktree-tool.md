# Pi extension: `git_worktree_add` tool (gw worktree workflow)

Date: 2026-10-03

## Context

The user works with a bare-repo + worktree layout per project. Project `full-stack-template` (a.k.a. `abc`):

```
/Users/christian/github/full-stack-template      ← project root
├── .bare/                                       ← bare repo (gitdir)
├── .git                                         ← "gitdir: ./.bare" (root doubles as a worktree)
├── fst-develop/                                 ← main branch worktree (a.k.a. "abc-develop")
├── feat/
│   └── add-new-endpoint/                        ← worktree for branch feat/add-new-endpoint
├── fix/
│   └── logic-for-xyz/                           ← worktree for branch fix/logic-for-xyz
└── test/ …
```

Worktree location == `(root)/(prefix)/(name-of-branch-without-prefix)`. The user shells out with alias `gw` = `git worktree`, but shell aliases are **not** available in the non-interactive shells an extension spawns — the tool must run `git worktree …` directly.

Goal: a Pi extension tool the agent calls to run either:

1. **New branch + worktree:** `git worktree add -b <branch> <path>`
2. **Existing branch on origin → new worktree:** `git worktree add -b <branch> <path> origin/<branch>`

The tool detects which location it is running from and computes the worktree path relative to the cwd, so the exact base command (`../feat/add-new-endpoint`) falls out in case (a) and the correct `../`-count path in case (b):

- **(a) bare repo** — cwd is inside the bare repo's own directory (`.bare/`, e.g. the user cd'd into `…/full-stack-template/.bare`);
- **(b) nested worktree** — cwd is inside one of the worktrees (`fst-develop/`, `feat/<x>/`, or any subdirectory of one).

## Decisions (confirmed with user)

- **Q1 — create vs existing:** explicit parameter — Q1 answer: `mode: "new" | "remote"` (no auto-detection via ls-remote).
- **Q2 — prefixes:** follow the repo's commit-message guideline types (see **Reuse** for source): `build, ci, chore, docs, feat, fix, perf, refactor, revert, style, test`. The tool derives the folder from the branch name's prefix; unrecognized prefix → error listing valid prefixes (never silently create a root-level worktree).
- **Q3 — names:** tool name `git_worktree_add`; extension file `.pi/extensions/git-worktree.ts` **in this project** (NOT `~/.pi/agent/extensions/`).
- **Q4 — paths:** relative-to-cwd via `path.relative`, end state `(bare repo)/(prefix)/(name-without-prefix)`.

## Approach

One tool registered with `pi.registerTool(...)` following the existing project-extension style (`.pi/extensions/commit-changes.ts`). Git subprocesses via `pi.exec("git", [...], { signal: ctx.signal, cwd })` — returns `{ stdout, stderr, code }`, no throw on non-zero.

**Detection + path computation (uniform across all cwds):**
1. `git rev-parse --path-format=absolute --git-common-dir` with `cwd: ctx.cwd` — absolute commondir from anywhere (`.bare/`, any worktree, project root). Non-zero exit → error result "not a git repository (or git not installed)".
2. `git rev-parse --is-bare-repository` on the original cwd → only to report `location: "bare-repo" (case a) | "worktree" (case b)` in the details; not needed for path computation.
3. `root = dirname(commondir)` — assumes the bare repo dir (`.bare`) is a direct child of the worktree container; matches the described layout (this repo: `dirname(.../full-stack-template/.bare)` = `.../full-stack-template`).
4. Parse `branch` with `/^([a-z]+)\/([a-z]+(-[a-z]+)*)$/` — the prefix group is letters-only (then validated against the 11 guideline types); the name group is **strict lowercase kebab-case**: one or more lowercase letters, optionally followed by blocks of `-` + lowercase letters (`add-new-endpoint`, `logic-for-xyz` OK; a single-word name like `add` is also valid). Reject digits anywhere, uppercase, dots, underscores, consecutive dashes (`add--new`), a trailing dash (`add-`), or an empty name after the prefix. Reject other prefixes (clear message listing the valid ones) or malformed names.
5. **Path normalisation — no per-cwd edge cases:** always run git with `cwd: commondir` (i.e. *inside the bare repo*), so the worktree path argument is simply `"../" + branch` in every case. `target = path.join(root, branch)` (e.g. `.../full-stack-template/feat/add-new-endpoint`) is computed only for reporting/verification, never as the path argument:
   - from the fixed command cwd (`.bare`), `../feat/add-new-endpoint` always resolves to `root/feat/add-new-endpoint` — identical to the user's base command for every branch, regardless of where the Pi session itself is running (bare repo, `fst-develop/`, `feat/other/`, or any deep subdir — all the same)
6. Build argv and run with `{ cwd: commondir, signal: ctx.signal }`:
   - `new`: `["worktree", "add", "-b", branch, "../" + branch]`
   - `remote`: `["worktree", "add", "-b", branch, "../" + branch, "origin/" + branch]`
7. Result:
   - content (text): on success git stdout + absolute target path; on failure git stderr trimmed + practical hint (e.g. `… '<path>' already exists` → pick a new branch name; `did not match any file(s)` → run `git fetch origin` first).
   - details: `{ mode, branch, prefix, location: "bare-repo" | "worktree", cwd, root, targetPath, worktreePath: "../<branch>", argv, code, success }`.

**Parameter schema** (`Type.Object` from `typebox`, `StringEnum` from `@earendil-works/pi-ai`):
- `branch` (string): full branch name, e.g. `feat/add-new-endpoint`. Must start with one of the 11 guideline prefixes; the part after the prefix is strict lowercase kebab-case — lowercase letters only, optionally split by `-` + letters, matching `/^([a-z]+)\/([a-z]+(-[a-z]+)*)$/` (no digits, uppercase, dots, underscores, or edge dashes).
- `mode` (`StringEnum(["new", "remote"])`): `new` = create branch (`-b <branch> <path>`); `remote` = track existing origin branch (`-b <branch> <path> origin/<branch>`).

**Lockdown integration (required, or the tool never loads):** pi-lockdown only loads custom tools listed in `lockdown.customTools`. Add `"git_worktree_add": "allow"` to the project `lockdown.customTools` in `.pi/settings.json`. Leave it out of `lockdownSubagent.customTools` on purpose — subagents should not create worktrees (unlisted ⇒ not available to them).

## Files to modify

- NEW `.pi/extensions/git-worktree.ts` — the extension (tool `git_worktree_add`).
- EDIT `.pi/settings.json` — add `"git_worktree_add": "allow"` under `lockdown.customTools`.

## Reuse

- Tool registration + `pi.exec` pattern: `.pi/extensions/commit-changes.ts` (same repo; uses `Type` from `typebox`, `{ signal: ctx.signal, cwd }` options, code-checked results).
- Git discovery flags: `git rev-parse --git-common-dir --path-format=absolute`, `--is-bare-repository` (verified behavior on the real layout: `.bare/` → commondir=`.bare` & bare=true; `fst-develop/` → commondir=`../.bare` & bare=false; root → commondir=`.bare`).
- Prefix list source: `docs/general/commit-messages.md` — types: build, ci, chore, docs, feat, fix, perf, refactor, revert, style, test.
- `pi.exec` signature/options: Changelog + examples (`{ signal, timeout, cwd }`, result `{ stdout, stderr, code, killed? }`).

## Steps

- [x] Write `.pi/extensions/git-worktree.ts`:
  - register tool `git_worktree_add` (label "Git Worktree Add", model-facing description incl. the layout, prefix rule, and both commands; `promptSnippet`/`promptGuidelines` like commit-changes.ts)
  - execute: commondir probe → location probe (for details only) → prefix validation (`/^([a-z]+)\/([a-z]+(-[a-z]+)*)$/`, checked against the 11 types) → run `pi.exec("git", ["worktree", "add", …])` with `cwd: commondir` and path `"../" + branch` → result content + details (as in Approach)
- [x] Edit `.pi/settings.json`: add `"git_worktree_add": "allow"` to `lockdown.customTools`
- [x] Hand off to the user: `/reload` (or restart), then run through the Verification section yourself — the implementing agent must NOT create or remove worktrees

## Verification (performed by the user)

You run the verification yourself in your Pi session after `/reload` — the implementing agent only writes the two files and must NOT create or remove worktrees. Suggested steps:

1. `/reload` in a session under `fst-develop`; confirm the tool appears (and is not flagged by lockdown).
2. **Case (b) — create:** prompt the agent to call the tool with `branch=feat/pi-demo-add`, `mode=new`. Expect command `git worktree add -b feat/pi-demo-add ../feat/pi-demo-add` (run from inside `.bare`), success text with the absolute path, and `feat/pi-demo-add/` present with the new branch checked out (`git worktree list`).
3. **Remote mode:** push/ensure `feat/pi-demo-remote` exists on origin (fetch first if needed), call the tool with `mode=remote` → expect `origin/feat/pi-demo-remote` start point; verify the branch tracks origin.
4. **Deep subdir (case b):** launch a session in a deep subdir (e.g. `fst-develop/packages/db`) → same `../<branch>` command, `location: "worktree"`. Optional (case a): launch a session inside `.bare` — the command is identical with `location: "bare-repo"` (note: the project extension only loads when the session starts under this project, so case (a) needs the file copied to `~/.pi/agent/extensions/` first).
5. **Error paths:** invalid prefix (`misc/x`, or `foo` with no slash) → error listing the 11 prefixes; name violations rejected — digits anywhere (`feat/add2`, `feat/2fa`), uppercase (`feat/Demo`), consecutive or trailing dashes (`feat/add--new`, `feat/add-`), dots, underscores; valid names accepted (`feat/add`, `feat/add-new-endpoint`); existing branch/path → git error surfaced with a hint.
6. **Cleanup:** `git worktree remove <path>` for both demos; confirm the `feat/` folders are removed.

## Notes / caveats

- Project extensions load only in sessions whose working directory is under this project (`.pi/` is per working-directory). Launching Pi inside the bare repo or another project won't load this tool; if that's ever needed, copy the same file to `~/.pi/agent/extensions/git-worktree.ts` (the tool is cwd-agnostic — it always executes git from inside the bare repo, so session location never affects the command).
- `remote` mode does not fetch; it uses the locally-known `origin/<branch>` ref. On "did not match any file(s)" the hint tells the user to fetch.
- `pi.exec` runs an argv array (no shell) — no shell-quoting/alias issues; deliberately not using `gw`/shell.
