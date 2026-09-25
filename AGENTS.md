# AGENTS.md

Guidance for working in this repo. This file captures the durable norms and gotchas that are not obvious from the code. It is meant to be skimmed, not read linearly — go to the section you need.

## What this is

An **pnpm + Turborepo monorepo** with a **contract-first** architecture for near-end-to-end type safety:

- `apps/backend` — NestJS (Express) API, Prisma ORM
- `apps/frontend` — React 19 + Vite + TanStack Query
- `packages/api-contract` — shared oRPC contracts + Zod schemas (the single source of truth)
- `packages/db` — shared DB client

## Guidelines

Start at `docs/index.md`. It indexes the specific, task-scoped guidelines — read only the one(s) relevant to your task.

## Commands

Run everything from the repo root via the workspace scripts:

```bash
pnpm i           # install
pnpm dev     # turbo dev across all workspaces
pnpm build   # turbo build across all workspaces
```

**DO NOT** invent ad-hoc commands.

Notes:
- `pnpm test` at the repo root currently just exits 1 — there are no root-level tests. Unit tests live in `apps/backend` (`pnpm test` → jest) and cover `*.spec.ts` files.
- URLs (with infra up): frontend `http://localhost:3000`, backend `http://localhost:8080`, Mailpit `http://localhost:8025`, Dex `http://localhost:5556/dex`.

## Architecture invariants (do not break)

- **Contract-first:** every API surface is defined as an oRPC contract + Zod schema in `packages/api-contract/src/{contracts,schemas}`. The backend implements the contract; the frontend consumes it. Never hand-roll an endpoint on either side — add to the shared contract and import it.
- **Zod is the source of truth for shapes** (inputs `z.input<typeof Schema>` / outputs `z.infer<typeof Schema>`). The backend service layer must parse outputs against the output schema before returning.
