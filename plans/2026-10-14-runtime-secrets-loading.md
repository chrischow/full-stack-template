# Runtime Secrets Loading in `apps/backend`

> Status: DRAFT (rev 2) — decisions captured below; pending final review.

## Context

Today the backend loads config **synchronously at module-import time**:

- `apps/backend/src/env/schema.ts` runs `configDotenv({ path: '../../.env.<NODE_ENV>' })` at
  module scope, defines `EnvSchema` (Zod v4), and exports `env = EnvSchema.parse(process.env)`.
- `@nestjs/config` is already registered (`ConfigModule.forRoot({ isGlobal: true, validate })` in
  `app.module.ts`), but **nothing injects `ConfigService`** — 10 files import the `env` singleton
  directly via `@/env/schema`.
- Secrets currently come from env files (dev) and, in prod, would come from env vars. The
  `infra/secrets` Pulumi project already writes all 30 config keys to SSM under `/<stack>/<NAME>`
  (5 as `SecureString`), but **nothing reads SSM at runtime** — this task implements that reader.

Goal: add a secret-loading mode env var; load config either from `process.env` or from SSM (AWS
SDK); Zod-parse the result; and route config **usage** through `@nestjs/config` so consumers stop
reaching for the static `env` singleton.

## Approach

1. **New env vars** in `EnvSchema` (`apps/backend/src/env/schema.ts`):
   - `CONFIG_SOURCE: z.enum(['environment', 'ssm']).default('environment')` — selects the loader.
   - `SSM_PARAMETER_PREFIX: z.string().optional()` — required only when `CONFIG_SOURCE === 'ssm'`
     (enforce with `.superRefine`).
2. **Async config loader** (new file `apps/backend/src/env/loader.ts`) returning a Zod-validated `Env`:
   ```ts
   export async function loadEnv(): Promise<Env> {
     const source = process.env.CONFIG_SOURCE ?? 'environment' // read raw: needed before parsing
     if (source !== 'ssm') return EnvSchema.parse(process.env)
     const ssmValues = await fetchSsmParameters(process.env.SSM_PARAMETER_PREFIX)
     return EnvSchema.parse({ ...process.env, ...ssmValues }) // SSM authoritative, env fallback
   }
   ```
   - `fetchSsmParameters(prefix)`: `new SSMClient({ region: process.env.AWS_REGION })` (default credential
     chain — no explicit creds), paginated `GetParametersByPathCommand({ Path, Recursive: true,
     WithDecryption: true })`, map each param `Name` basename → `Value`.
3. **Register via `@nestjs/config`**: replace `ConfigModule.forRoot({ validate })` with
   `ConfigModule.forRootAsync({ isGlobal: true, useFactory: loadEnv })` so the Zod-parsed `Env` becomes the
   `ConfigService` values. Consumers inject `ConfigService<Env, true>` and read with `{ infer: true }` to
   keep Zod-derived types (Zod stays the source of truth).
4. **Migrate all consumers** off the `env` singleton to injected `ConfigService` (option A — chosen).

### Config resolution semantics

- `environment` mode: `EnvSchema.parse(process.env)` (unchanged behaviour).
- `ssm` mode: `EnvSchema.parse({ ...process.env, ...ssmValues })`. SSM wins for keys it provides;
  `process.env` supplies bootstrap-only keys (`CONFIG_SOURCE`, `NODE_ENV`, `APP_PORT`) and fallbacks.
- `CONFIG_SOURCE`, `NODE_ENV`, `APP_PORT` are always read from `process.env` (needed to pick the loader /
  dotenv file and to bind the port before/without SSM).
- Secrets so far only exist via `SSM_PARAMETER_PREFIX`: prefix used is e.g. `/prototype` (from `infra/secrets`).

### Non-DI rework estimate (option A)

| Spot | File(s) | Rework | Effort |
|---|---|---|---|
| `pinoHttp` const | `logger/logger.ts` + `app.module.ts` | Convert to `createPinoHttp(nodeEnv)`; use `LoggerModule.forRootAsync({ inject:[ConfigService], useFactory })`. `nestjs-pino@4.6.1` **supports** `forRootAsync` (`.d.ts` confirmed). | Small |
| `CacheModule` factory | `app.module.ts` | Add `inject: [ConfigService]`; read `DB_*`/`KV_TTL_SECONDS`. | Trivial |
| `APP_PORT` | `main.ts` | `app.get(ConfigService).get('APP_PORT')`. | Trivial |
| `computeHmac` | `auth/utils.ts` (+ `otp.service.ts`) | Add `secret` param; `OtpService` (already `@Injectable`) passes `config.get('OTP_SECRET')` at 2 call sites (71, 158). | Small |

`session.middleware.ts` is already `@Injectable` → just add `ConfigService`. **Hidden cost:** 10 spec files
instantiate services via `providers: [X]` with no mocks; new `ConfigService` deps break `compile()` unless
stubbed. Tests are **not** in CI (`ci.yml` = lint/check-types/format/build only).

## Key findings (from code exploration)

- **AWS SDK v3 is present** (`@aws-sdk/client-sesv2` + full credential-provider chain), but
  **`@aws-sdk/client-ssm` is NOT installed** → this is the install pause point.
- Consumers of the `env` singleton (10 files):
  - DI-injectable: `middleware/session.middleware.ts`, `mail/mail.service.ts`,
    `prisma/prisma.service.ts`, `auth/passkey.service.ts`, `auth/auth.strategy.ts`,
    `auth/auth.controller.ts`, `auth/otp.service.ts`.
  - Non-DI / top-level: `logger/logger.ts` (`pinoHttp` reads `NODE_ENV` at import),
    `app.module.ts` (`CacheModule.registerAsync` `useFactory`), `main.ts` (raw
    `process.env.APP_PORT`), `auth/utils.ts` (module-scope `computeHmac` reads `OTP_SECRET`).
- `EnvSchema` keys: 30 total (DB_*, SESSION_*, OAUTH_*, OTP_*, AWS_REGION, SES_*, PASSKEY_*, APP_*,
  NODE_ENV, KV_TTL_SECONDS). `APP_PORT` is only read in `main.ts` via raw `process.env`.
- `infra/secrets`: 30 params at `/<stack>/<ENV_NAME>` (SecureString set includes `DB_PASSWORD`,
  `SESSION_SECRET`, `OAUTH_CLIENT_SECRET`, `OTP_SECRET`). Per decision 2, `EnvSchema` key names are the
  source of truth and `infra/secrets` naming is out of scope for this task.

## Files likely to modify

- `apps/backend/src/env/schema.ts` — add `CONFIG_SOURCE` + `SSM_PARAMETER_PREFIX`; keep `EnvSchema`.
- `apps/backend/src/env/loader.ts` (**new**) — async `loadEnv()` + SSM fetch.
- `apps/backend/src/app.module.ts` — `ConfigModule.forRootAsync`; `LoggerModule.forRootAsync`; `CacheModule` inject.
- `apps/backend/src/logger/logger.ts` — export `createPinoHttp(nodeEnv)` factory.
- `apps/backend/src/main.ts` — port from `ConfigService`.
- `apps/backend/src/auth/utils.ts` — `computeHmac(secret, value)`.
- DI-injectable consumers: `prisma/prisma.service.ts`, `mail/mail.service.ts`,
  `auth/{passkey.service,otp.service,auth.strategy,auth.controller}.ts`, `middleware/session.middleware.ts`.
- `apps/backend/package.json` — add `@aws-sdk/client-ssm` (**user installs**).
- `.env.development` — add `CONFIG_SOURCE` (+ `SSM_PARAMETER_PREFIX` for local SSM testing).

## Reuse

- `EnvSchema` + `validate` already in `apps/backend/src/env/schema.ts`.
- `ConfigModule.forRoot` already global in `app.module.ts`.
- AWS credential-provider chain already resolvable via `@aws-sdk/client-sesv2` transitive deps.
- SSM parameter naming from `infra/secrets/index.ts` (`/<stack>/<NAME>`).

## Steps

> After **EACH STEP**, run the code-quality checks (`lint:fix`, `format:fix`, `check-types`) and commit,
> including the plan-file checkbox updates.

- [x] Step 1 — Add `CONFIG_SOURCE` enum + `SSM_PARAMETER_PREFIX` to `EnvSchema` and `.env.development`.
      Keep the existing `validate`/`env` exports temporarily so the app still boots.
- [x] Step 2 — **PAUSE — user installs the dependency**:
      `pnpm --filter=backend add @aws-sdk/client-ssm`.
- [x] Step 3 — Create `apps/backend/src/env/loader.ts`: `loadEnv()` + `fetchSsmParameters()`
      (`GetParametersByPath`, `Recursive`, `WithDecryption`). Fail fast on fetch/parse errors.
- [x] Step 4 — Switch `app.module.ts` to async config loading. **Plan deviation:** `@nestjs/config@4.0.4`
      has no `forRootAsync`; used `ConfigModule.forRoot({ isGlobal: true, load: [loadEnv] })` instead
      (`forRoot` is itself `async` and awaits `load` factories, whose flat return value is merged at the
      top level of `ConfigService`). Verify a clean boot with `CONFIG_SOURCE=environment`.
- [x] Step 5 — Migrate DI-injectable consumers to injected `ConfigService<Env, true>` (`{ infer: true }`):
      `prisma.service.ts`, `mail.service.ts`, `auth.strategy.ts`, `auth.controller.ts`,
      `passkey.service.ts`, `otp.service.ts`, `session.middleware.ts`.
- [x] Step 6 — Rework non-DI spots: `createPinoHttp` + `LoggerModule.forRootAsync`; `CacheModule`
      `inject`; `main.ts` port; `computeHmac(secret, value)`.
- [x] Step 7 — Remove the now-unused `env` singleton (+ `validate` if unused) and confirm nothing imports
      `@/env/schema`'s `env` anymore.
- [x] Step 8 — Fix the specs (add `ConfigService` provider stubs) if keeping them green locally.
      Added stubs to the 5 affected specs. `jest` is not runnable in the execution environment, so the
      suite could not be executed here.
- [x] Step 9 — Verification (below). Static gates pass; runtime boot checks were not runnable in the
      execution environment (see results).

## Verification

- **Static gates:** `lint:fix`, `format:fix`, `check-types`, `build` all pass (via `run_npm_script`).
- **`environment` mode:** boot the app with `CONFIG_SOURCE=environment` (default) and the existing
  `.env.development`. Confirm it starts, binds `APP_PORT`, and logs no Zod errors. Smoke-test DB
  (Prisma), session cookie, and SES client construction.
- **`ssm` mode:** seed a local SSM emulator (moto/LocalStack) or use a real `SSM_PARAMETER_PREFIX`;
  run with `CONFIG_SOURCE=ssm`. Confirm values are fetched, `SecureString`s decrypted (`WithDecryption`),
  and SSM values override any colliding `process.env` values.
- **Fail-fast:** with `CONFIG_SOURCE=ssm` and a bad/missing prefix, confirm the process exits non-zero
  (no partial boot).
- **Cleanup check:** `grep` confirms no remaining imports of the `env` singleton from `@/env/schema`;
  `@nestjs/config` is the sole config access path.

### Execution results (2026-10-14)

- **Static gates — PASS:** `lint:fix` (0 errors, only pre-existing warnings), `format:fix`,
  `check-types`, and `build` all succeed at HEAD.
- **`environment` mode boot — NOT RUN:** the execution environment exposes no shell, only the
  allowlisted `pnpm` scripts (`build`, `lint`, `lint:fix`, `check-types`, `format`, `format:fix`);
  booting additionally needs Postgres/dex. Compile-time verification only.
- **`ssm` mode boot — NOT RUN:** no shell / no SSM emulator available.
- **Fail-fast — NOT RUN, but implemented:** `loadEnv()` throws `SSM_PARAMETER_PREFIX is required when
  CONFIG_SOURCE is "ssm".` before any parse, and `EnvSchema.parse` throws on invalid SSM values; both
  reject the `ConfigModule.forRoot` load factory, aborting bootstrap.
- **Cleanup check — PASS:** confirmed zero `env` singleton imports; remaining `@/env/schema` imports are
  type-only (`Env`). `validate` removed as unused.
- **Build-output fix (post-verification):** `apps/backend/tsconfig.build.json` now sets
  `tsBuildInfoFile: "./dist/tsconfig.build.tsbuildinfo"`. Previously `nest-cli.json`'s
  `deleteOutDir: true` combined with `incremental: true` (state stored outside `dist`) let `nest build`
  wipe `dist` and then emit nothing because `tsc` considered everything up to date — so `start`/`dev`
  failed with `Cannot find module .../apps/backend/dist/main`. Binding the incremental state to `dist`
  means a wiped `dist` forces a full emit; verified `dist/main.js` is emitted after a cache-miss build.

---

## Decisions

1. **Env var** — `CONFIG_SOURCE`, enum `['environment', 'ssm']` (default `environment`).
2. **SSM read** — single `GetParametersByPath` call under `SSM_PARAMETER_PREFIX`. Ignore `infra/secrets`
   naming; `EnvSchema` is correct.
3. **Consumer migration** — option A: migrate all consumers to `ConfigService` (see non-DI estimate table).
4. **SSM scope** — fetch all params under the prefix and merge: `EnvSchema.parse({ ...process.env,
   ...ssmValues })`. SSM authoritative; bootstrap-only vars stay in `process.env`.
5. **Credentials** — default AWS credential provider chain (no explicit creds on `SSMClient`). On Lambda the
   execution-role creds arrive via `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN`.
6. **Failure behaviour** — fail fast: crash on SSM fetch or Zod parse failure.

## Credential chain (for reference)

`@aws-sdk/credential-provider-node` resolves in order: (1) env vars `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` (+ `AWS_SESSION_TOKEN`); (2) `~/.aws/credentials` + `~/.aws/config`
(`AWS_PROFILE`, assume-role profiles); (3) web identity (`AWS_WEB_IDENTITY_TOKEN_FILE` + `AWS_ROLE_ARN`,
EKS IRSA); (4) ECS container credentials (task role); (5) EC2 IMDSv2 (instance profile). Lambda injects
step-1 creds for the execution role.
