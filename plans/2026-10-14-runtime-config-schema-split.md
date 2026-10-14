# Split runtime configuration into bootstrap and managed schemas

## Context

The backend currently validates 32 flat configuration keys through `EnvSchema` after choosing a source in `loadEnv`. Four keys control bootstrap (`CONFIG_SOURCE`, `SSM_PARAMETER_PREFIX`, `NODE_ENV`, `AWS_REGION`); the remaining 28 are managed configuration (5 secrets and 23 non-secrets). Parse bootstrap from `process.env` before selecting/fetching the managed source, then validate the complete flat result with `EnvSchema` before exposing it through `ConfigService`.

## Approach

- Export two flat Zod object schemas, `BootstrapConfigSchema` (4 keys) and `ManagedConfigSchema` (28 keys), from `apps/backend/src/env/schema.ts`; compose their object shapes into `EnvSchema` (not a Zod `z.union`, which would accept only one group). Require `CONFIG_SOURCE` and `NODE_ENV` with no defaults; require nonblank `SSM_PARAMETER_PREFIX` and `AWS_REGION` before SSM access, but allow them to be absent in `environment` mode. Keep `AWS_REGION`'s existing default for validated output in `environment` mode so `Env['AWS_REGION']` remains a string for ConfigService consumers: validate required **raw** SSM region before applying that default. Preserve existing managed validators/defaults (including numeric coercion behavior), `Env` and the conditional prefix rule.
- Keep the existing module-scope dotenv load; “present in `process.env`” means present **after** dotenv loads, preserving local development. Parse bootstrap from `process.env` at the beginning of `loadEnv`, before source selection or SSM access; check raw presence/nonblank SSM-only inputs before defaults can mask omission. In `environment` mode, merge parsed bootstrap with managed values from `process.env` and parse using `EnvSchema`. In `ssm` mode, fetch using validated prefix/region, merge parsed bootstrap with **only** fetched managed SSM values, and parse using `EnvSchema` (missing managed keys can only use Zod schema defaults). Return the validated flat result to `ConfigModule.forRoot({ load: [loadEnv] })`.
- Never merge raw `process.env` into the managed set in `ssm` mode or let SSM entries replace bootstrap values; preserve the 5 SecureString / 23 String classification. Pulumi provisioning changes, including removal of `NODE_ENV` and `AWS_REGION` from SSM, are handled separately by the user.

## Files to modify

- `apps/backend/src/env/schema.ts` — split/export schemas; compose full schema and keep conditional prefix rule.
- `apps/backend/src/env/loader.ts` — early bootstrap parse, resolved region and managed-only merge, final full parse.

## Reuse

- Existing `loadEnv` / `fetchSsmParameters` in `apps/backend/src/env/loader.ts` (including paginated, decrypted SSM fetch).
- Existing `EnvSchema`, Zod field validators/defaults, and dotenv loading in `apps/backend/src/env/schema.ts`.
- Existing `ConfigModule.forRoot({ load: [loadEnv] })` in `apps/backend/src/app.module.ts` and consumers of `ConfigService<Env, true>` (no consumer rewrite).

## Steps

**After EACH implementation step, run `lint:fix`, `format:fix`, and `check-types` via `run_npm_script`, then commit the step with its updated plan-file checkbox.**

- [x] 1. Split the current 32 validators into the two named object schemas, compose `EnvSchema` with the SSM-only prefix/region checks, and preserve `Env` typing (including a string output for AWS_REGION) and agreed dotenv behavior.
- [x] 2. Refactor `loadEnv` to parse bootstrap before source selection/SSM access; use parsed prefix/region for SSM, exclude raw environment fallback for managed keys in SSM mode, and return the final `EnvSchema.parse` result in both modes.

## Verification

Verification is owned by the user. Implementation steps still require the repository's code-quality checks as stated above.
