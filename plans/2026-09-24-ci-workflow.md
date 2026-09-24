# GitHub Actions CI Workflow

Date: 2026-09-24 · Status: final

## Context

The repo has **no CI** (`.github/` doesn't exist). Add a GitHub Actions workflow that runs the repo's root-level npm scripts in two stages:

1. **Stage 1 — quality gates:** `npm run lint` → `npm run check-types` → `npm run format`
2. **Stage 2 — build:** `npm run build`

Mirrors `docs/general/code-quality-checks.md` (lint → format → check-types from repo root) + `npm run build`. Tests excluded (root `npm test` exits 1).

## Decisions (all resolved)

1. **Trigger:** push to `develop`.
2. **Lint:** read-only `npm run lint` in CI.
3. **Format split (consistency with lint/lint:fix):** root `format` becomes read-only `prettier --check`; new `format:fix` = `prettier --write`. Live callers of the old behavior get updated: `lint-staged` → `npm run format:fix`, `docs/general/code-quality-checks.md` → `npm run format:fix`.
4. **Node:** GitHub's Node 22 (`actions/setup-node` `node-version: 22`); npm stays at whatever ships with it (devEngines npm 10.9.8 pin is informational).
5. **Cache:** `.turbo` local cache persists across runs via `actions/cache` — **no Turborepo remote cache / secrets needed**. Each turbo-running job restores *and* saves `.turbo` itself (key + `restore-keys` fallback) so parallel jobs don't depend on each other's saves; `actions/setup-node` with `cache: 'npm'` covers deps.
6. **Env files:** non-issue (verified) — no `.gitignore` rule matches `.env.development`; and even if absent, `dotenv-cli` swallows the error and `prisma generate` never connects to the DB. No CI steps needed.
7. **Frontend check-types fix:** change script to `tsc -b --noEmit` (verified supported by installed TS 6.0.2; child configs already `noEmit: true`, `.tsbuildinfo` under gitignored `node_modules/.tmp`, zero emitted files). Fixes the vacuous-pass gap (currently `tsc --noEmit` on a solution config type-checks 0 files).
8. **Job split (annotation feedback):** stage-1 checks run as three separate **parallel** jobs — `lint`, `check-types`, `format`; the `build` job `needs: [lint, check-types, format]`.
9. **Postinstall generation (annotation feedback):** add `postinstall` scripts so a fresh `npm i`/`npm ci` produces everything `check-types` needs — `packages/api-contract` → `tsc` (dist), `packages/db` → `npm run db:generate` + `tsc` (Prisma client + dist). Removes the need for an explicit partial-build step in CI.

## Verified findings (scout)

**check-types needs `dist` + Prisma client present** (backend): `@repo/api-contract` and `@repo/db` resolve via `exports`/`types` → **dist** (`packages/db` also re-exports gitignored `generated/` Prisma client). In a fresh checkout these are absent → TS2307. **Resolution: `postinstall` scripts (decision #9) generate all three artifacts at `npm ci`/`npm i` time**, so the workflow needs no explicit partial-build step and stage 1 works in a fresh clone. (Fallback if a workspace `postinstall` proves unreliable in practice: re-add `npm run build -w packages/db -w packages/api-contract` as a check-types prereq step.)

**`tsc -b --noEmit` support:** build-mode CLI validation (`parseBuildCommand`) rejects only clean/force/verbose/watch/dry combos; `noEmit` is in `commonOptionsWithBuild`; `updateOutputTimestampsWorker` early-returns on `noEmit` → full type-check, no emit, exit code from diagnostics. TS6310 "referenced project may not disable emit" guard never fires (solution config has `files: []`).

**Scripts:** root `lint` = `turbo lint --continue`; `check-types` = `turbo check-types --continue`; `build` = `turbo build`; turbo `^2.10.12`; per-workspace format scripts (frontend/backend) are separate roots and unaffected by the root-script split.

## Files to modify

- [x] `package.json` — split `format` (`prettier --check`) / `format:fix` (`prettier --write`, same globs); `lint-staged` command → `npm run format:fix`
- [x] `docs/general/code-quality-checks.md` — `npm run format` → `npm run format:fix` (line 7)
- [x] `apps/frontend/package.json` — `check-types` → `tsc -b --noEmit`
- [x] `packages/api-contract/package.json` — add `postinstall: "tsc"` (emit `dist/` on install)
- [x] `packages/db/package.json` — add `postinstall: "npm run db:generate && tsc"` (Prisma client + `dist/` on install)
- [x] `.prettierignore` — ignore build/generated outputs (`**/dist/`, `**/generated/`) so the `format` check stays stable when postinstall regenerates Prisma's unformatted client
- [x] `.github/workflows/ci.yml` — new workflow

## Approach

Single workflow `.github/workflows/ci.yml` (GH Actions has no native stages). Stage 1 is three **separate, parallel jobs** — one per check (they're independent, so this parallelizes CI); the `build` job gates on all three:

- **`lint` job**: checkout → setup-node (22, `cache: 'npm'`) → `npm ci` → restore `.turbo` → `npm run lint` → save `.turbo`
- **`check-types` job**: checkout → setup-node → `npm ci` → restore `.turbo` → `npm run check-types` → save `.turbo` (prereq artifacts are produced by `postinstall` during `npm ci` — decision #9; no explicit build step needed)
- **`format` job**: checkout → setup-node → `npm ci` → `npm run format` (read-only check; no turbo task involved, no `.turbo` handling needed)
- **`build` job** (stage 2): `needs: [lint, check-types, format]` → checkout → setup-node → `npm ci` → restore `.turbo` → `npm run build` → save `.turbo`

Caching: `actions/setup-node` `cache: 'npm'` in every job (deps) + per-job `actions/cache/restore` **and** `actions/cache/save` pair on `.turbo`. **Cache keys are job-scoped** — `${{ runner.os }}-turbo-${{ hashFiles('**/package-lock.json') }}-${{ github.job }}` — so each job has its own cache silo (`${{ github.job }}` = job id: lint/check-types/build never collide). `restore-keys: ${{ runner.os }}-turbo-${{ github.job }}-` falls back to that job's most recent cache when the lockfile hash changed. Each job owns its own restore/save — required now that jobs run in parallel and can't rely on each other's saves; per-job keys also avoid cross-job duplicate-save warnings. Tradeoff of the split: 4 jobs each do checkout + `npm ci` (amortized by npm cache). If strict serialization of the checks is preferred over parallelism, add `needs` chains instead.

## Workflow sketch

```yaml
name: CI
on:
  push:
    branches: [develop]
jobs:
  lint:                          # stage 1a
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/cache/restore@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ hashFiles('**/package-lock.json') }}-${{ github.job }}
          restore-keys: |
            ${{ runner.os }}-turbo-${{ github.job }}-
      - run: npm run lint
      - uses: actions/cache/save@v4
        with: { path: .turbo, key: ${{ runner.os }}-turbo-${{ hashFiles('**/package-lock.json') }}-${{ github.job }} }
  check-types:                   # stage 1b (artifacts from postinstall during npm ci)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/cache/restore@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ hashFiles('**/package-lock.json') }}-${{ github.job }}
          restore-keys: |
            ${{ runner.os }}-turbo-${{ github.job }}-
      - run: npm run check-types
      - uses: actions/cache/save@v4
        with: { path: .turbo, key: ${{ runner.os }}-turbo-${{ hashFiles('**/package-lock.json') }}-${{ github.job }} }
  format:                        # stage 1c (no turbo task; no .turbo handling)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run format                                          # now prettier --check
  build:                         # stage 2
    needs: [lint, check-types, format]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: actions/cache/restore@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ hashFiles('**/package-lock.json') }}-${{ github.job }}
          restore-keys: |
            ${{ runner.os }}-turbo-${{ github.job }}-
      - run: npm run build                                         # turbo build
      - uses: actions/cache/save@v4
        with: { path: .turbo, key: ${{ runner.os }}-turbo-${{ hashFiles('**/package-lock.json') }}-${{ github.job }} }
```

Notes: `build` runs only after all three checks pass (`needs`). Keys are job-scoped via `${{ github.job }}` (job id — `lint`/`check-types`/`build`), so each job has its own cache and restores via its own `restore-keys` prefix. `actions/cache/restore` + `actions/cache/save` keep the cache within each job (save runs as a post-step once the job's turbo tasks complete). If the separate restore/save actions misbehave in practice, fall back to `actions/cache@v4` (restore-if-exists, save-on-miss) — fine-tune at execution.

## Steps

- [x] 1. `package.json`: `format` → `prettier --check '<globs>'`; add `format:fix` → `prettier --write '<globs>'` (same two globs as today); `lint-staged` `"npm run format"` → `"npm run format:fix"`
- [x] 2. `docs/general/code-quality-checks.md`: update step 2 command to `npm run format:fix`
- [x] 3. `apps/frontend/package.json`: `check-types` → `tsc -b --noEmit`
- [x] 4. `packages/api-contract/package.json`: add `"postinstall": "tsc"`; `packages/db/package.json`: add `"postinstall": "npm run db:generate && tsc"` — on `npm i`/`npm ci` this emits `api-contract/dist`, `db/generated`, `db/dist`, so check-types works in a fresh clone with no prior build (verified: npm runs workspace postinstall; `npm install` recreated all three artifacts)
  - Exec-time addition (flagging deviation): root `.prettierignore` — `format` globs swept gitignored build/generated files; after a fresh `npm ci` they're unformatted, so the CI `format` job would fail without it
- [x] 5. Create `.github/workflows/ci.yml` per sketch: 4 jobs (`lint`, `check-types`, `format`, `build`), `build` `needs` all three, job-scoped `.turbo` restore/save + `restore-keys`

## Out of scope / future

- Turborepo remote cache (needs Vercel token/team secrets) — add later if wanted.
- Tests (root `npm test` exits 1; backend jest lives in `apps/backend`).
- Source-path type resolution (tsconfig `paths` → `src` instead of dist) — possible future cleanup, not needed for CI.