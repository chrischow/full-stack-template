# AGENTS.md

This file captures the durable norms and gotchas that are not obvious from the code. It is meant to be skimmed, not read linearly — go to the section you need.

## What's in this repo

A **pnpm + Turborepo monorepo** with a **contract-first** architecture for near-end-to-end type safety:

- `apps/backend` — NestJS (Express) API
- `apps/frontend` — React 19 + Vite + TanStack Query. Files under `src/wireframes` are placeholder-only mock pages on a DEV-only `/wireframes` route (no data fetching) — not prod code. See `docs/frontend/creating-wireframes.md` and `docs/frontend/promoting-wireframes.md`.
- `packages/api-contract` — shared oRPC contracts + Zod schemas (the single source of truth)
- `packages/db` — shared Prisma ORM client

## Commands

Run everything from the repo root using the `run_npm_script` tool.

**DO NOT** invent ad-hoc commands.

- **After every code change**, run the code quality checks via `run_npm_script`: `lint:fix`, `format:fix`, `check-types`                                                               
- **Create NestJS components only with `nest_generate`**, in this order: module → service → provider → gateway → pipe → filter → guard → interceptor → controller → decorator → middleware. Never hand-write them.


## Architecture invariants (do not break)

- **Contract-first:** every API surface is defined as an oRPC contract + Zod schema in `packages/api-contract/src/{contracts,schemas}`. The backend implements the contract; the frontend consumes it. Never hand-roll an endpoint on either side — add to the shared contract and import it.
- **Zod is the source of truth for shapes** (inputs `z.input<typeof Schema>` / outputs `z.infer<typeof Schema>`). The backend service layer must parse outputs against the output schema before returning.


## Guidelines

Start at `docs/index.md`. It indexes the specific, task-scoped guidelines — read only the one(s) relevant to your task.