# Plan: git-changes-extension

Date: 2026-09-23 · Status: Ready

## Context

The user wants a Pi extension in this repo that registers **exactly one tool** with **no arguments** which returns the **line-by-line staged, unstaged, and untracked git changes** — i.e. a superset of the existing `git_staged_changes` tool.

Repo facts (verified via scout):
- Pi version: `@earendil-works/pi-coding-agent` 0.87.1 (root package.json); node 22.23.2 (`.nvmrc`).
- Extensions live in `.pi/extensions/` (9 tracked `.ts` files already), auto-discovered via jiti — **no build step**, source TS is run directly. Load order: project `.pi/extensions/` → agent dir → settings/`-e` flags.
- `.pi/settings.json` runs `@chrischow/pi-lockdown`: a custom tool is only callable if listed in `lockdown.customTools` (interactive) **and** `lockdownSubagent.customTools` (headless/subagent); unlisted → blocked. New tool must be added to BOTH maps.
- Canonical template: `.pi/extensions/git-staged-changes.ts` (no-arg tool, probes `git rev-parse --git-dir`, runs `pi.exec("git", ["diff", "--cached"], ...)`, returns `{ content, details }`).
- `.pi/` is outside turbo/lint/format/check-types targets — no repo tooling compiles extensions.
- Repo is a git **linked worktree** (`.git` is a file → `{core}.bare/worktrees/fst-develop`); `git rev-parse --show-toplevel` in the worktree returns the worktree root. Probing `--git-dir` keeps behavior identical from any subdirectory (existing convention).
- `color.diff` config: unset everywhere → pipes capture no color anyway; pass `--color=never` for robustness (official example convention).

## Approach

Create a single-file extension `.pi/extensions/git-changes.ts` modeled directly on `git-staged-changes.ts`:

- `import { Type } from "typebox"; import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";`
- Default-export factory `(pi: ExtensionAPI) => { pi.registerTool({ name, label, description, parameters: Type.Object({}), async execute(toolCallId, params, signal, onUpdate, ctx) { ... } }); }`
- No-arg tool: `parameters: Type.Object({})` (proven pattern).
- Identity (resolved Q1): `name: "git_changes"`, `label: "Git Changes"`, model-facing `description` covering staged + unstaged + untracked. Coexists with `git_staged_changes` (kept untouched).
- In `execute`:
  1. Probe `git rev-parse --git-dir` (non-zero → return friendly "not a git repository" text, like the existing tool).
  2. Run via `pi.exec` (argv spawn, no shell):
     - staged: `git diff --staged --color=never`
     - unstaged: `git diff --color=never`
     - untracked: `git ls-files --others --exclude-standard`
  3. Assemble ONE flat text blob with blank-line-separated sections (resolved Q2):
     ```
     === STAGED ===
     <raw `git diff --staged` lines, or "No staged changes.">

     === UNSTAGED ===
     <raw `git diff` lines, or "No unstaged changes.">

     === UNTRACKED ===
     <paths from `git ls-files --others --exclude-standard`, one per line, or "No untracked files.">
     ```
  4. Per-section size guard (resolved Q3): if a section's line count exceeds a threshold (e.g. `MAX_SECTION_LINES = 2000`), do NOT emit the diff — instead list the affected filenames plus a remark that the section had too many lines. Filenames per section: `git diff --staged --name-only --color=never` (STAGED), `git diff --name-only --color=never` (UNSTAGED), or the already-collected path list (UNTRACKED). Remark style: `[Section omitted: N lines exceeds the 2000-line limit; filenames only — run git diff … for the full diff]`.
  5. Return `{ content: [{ type: "text", text }], details: {} }`.
- Untracked files: paths only, never contents (resolved Q4).
- Register the tool name in `.pi/settings.json` `lockdown.customTools` and `lockdownSubagent.customTools` (read-only, `allow` — mirrors `git_staged_changes`).

## Files to modify

| File | Action |
| --- | --- |
| `.pi/extensions/git-changes.ts` | Add — the new extension |
| `.pi/settings.json` | Edit — add tool to both lockdown maps |

## Reuse

- `.pi/extensions/git-staged-changes.ts` — canonical no-arg template (git probe, `pi.exec`, return shape).
- `.pi/extensions/commit-changes.ts` — `git add .` tool; reference for repo-root probing convention.
- Pi docs: `docs/extensions.md` (architecture, API), `examples/extensions/tools.ts` (registerTool shape).
- `plans/2026-09-23-commit-changes-extension.md` — same-domain prior plan; conventions this file mirrors.

## Steps

- [ ] Step 1 — Write `.pi/extensions/git-changes.ts`: `registerTool({ name: "git_changes", label: "Git Changes", description, parameters: Type.Object({}), execute })`; probe `git rev-parse --git-dir`; run `git diff --staged --color=never`, `git diff --color=never`, `git ls-files --others --exclude-standard` via `pi.exec`; assemble the `=== STAGED ===` / `=== UNSTAGED ===` / `=== UNTRACKED ===` blob with "No … changes." notes; per-section size guard → filenames + "too many lines" remark.
- [ ] Step 2 — Update `.pi/settings.json`: add `"git_changes": "allow"` to `lockdown.customTools` and `lockdownSubagent.customTools` (leave `git_staged_changes` entries intact).

## Decisions (resolved with user on 2026-09-23)

- Q1 — Tool name: **`git_changes`**, coexisting with the existing `git_staged_changes` (left untouched).
- Q2 — Output format: **one flat text blob** with `=== STAGED ===` / `=== UNSTAGED ===` / `=== UNTRACKED ===` headers; raw unified-diff lines under the first two, path list under the third; "No … changes." notes for empty sections.
- Q3 — Large diffs: **per-section size guard** — if a section's line count exceeds the threshold (e.g. 2000), replace that section's diff with its affected filenames + a "too many lines" remark.
- Q4 — Untracked files: **paths only**, no file contents.

Plan is ready for execution via .agents/skills/execute-plan