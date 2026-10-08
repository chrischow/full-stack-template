# Plan: Implement the bootstrap prototype stack

Date: 2026-10-07 · Status: draft

## Context

The repo has no IaC today. `rfc/2026-10-06-rfc-pulumi-iac-self-managed-state.md` selects **Pulumi (TypeScript)
with self-managed S3 state** and lays out three Pulumi projects under `infra/`:

- `bootstrap` — one S3 state bucket per AWS account (stacks `prototype`, `staging`, `production`)
- `prototype` — the prototype workload (stack `prototype`)
- `production` — staging + production workloads

All three projects currently exist only as stubs: `Pulumi.yaml`, `index.ts` (imports `@pulumi/pulumi`
only), `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`. There are **no**
`Pulumi.<stack>.yaml` files, no `@pulumi/aws` dependency, no `infra/scripts/`, no `docs/infra/`.

The bootstrap project must exist before anything else can run, because every other project logs into the
S3 state bucket that bootstrap creates (`pulumi login s3://<bucket>/<prefix>`). The structure is already
scaffolded under `infra/`, but it is an empty shell: `index.ts` imports `@pulumi/pulumi` and nothing else,
there is no `@pulumi/aws` dependency, and no `Pulumi.<stack>.yaml` files exist.

This plan covers **only** the `bootstrap` project's **`prototype` stack** (scope decision A): create the
prototype account's S3 state bucket + minimum supporting resources, and migrate that stack's own state
from the local backend into the new bucket. Nothing else from the RFC is in scope.

## Decisions (resolved with user)

1. **Scope = A.** Only the `bootstrap/prototype` stack. The `staging`/`production` bootstrap stacks, the
   `prototype`/`production` workload projects, CI pipelines, and `docs/infra/` are **out of scope** for
   this plan (follow-up plans).
2. **`<accountId>` is an explicit stack config value**, not a runtime data-source lookup. It is required
   via `pulumi.Config` (e.g. `accountId`) and set in `Pulumi.prototype.yaml` per account.
3. **The one-time local→S3 state migration runbook is authored in this plan** (see "Runbook" below)
   and then committed to `infra/bootstrap/README.md`. No helper script or `docs/infra/` doc is created
   in this slice.
4. **No CI changes.** No `deploy-prototype.yml`, no `ci.yml` edits. `infra/**` keeps only the existing
   `lint`/`format`/`check-types` coverage.
5. **The prototype account is under a non-standard profile name.** `AWS_PROFILE` is supplied at runtime
   (never committed); the RFC's placeholder `app-prototype` is illustrative only. The bucket name is
   profile-independent: `<appName>-pulumi-state-<envSlug>-<accountId>`.

## Approach

Implement the prototype stack with `@pulumi/aws` (classic) inside `infra/bootstrap/index.ts`. The program
is written **stack-generically** (it reads `pulumi.getStack()` and a `stackName → shortName` map so
`staging`/`production` can reuse it later) but **only the `prototype` stack config is added now**.

Resources, per the RFC sketch — exactly one state bucket plus the minimum to make it a valid Pulumi
backend:

- `aws.s3.Bucket` named `${appName}-pulumi-state-${envSlug}-${accountId}`, where `envSlug` is derived
  from the stack name (`pulumi.getStack()`; `prototype` now), with `forceDestroy: false`.
- `aws.s3.BucketVersioning` — versioning `Enabled`.
- `aws.s3.BucketOwnershipControls` — `BucketOwnerEnforced` (ACLs disabled).
- `aws.kms.Key` — per-account CMK, `enableKeyRotation: true`, `deletionWindowInDays: 30`.
- `aws.s3.BucketServerSideEncryptionConfiguration` — `aws:kms` default with the CMK,
  `bucketKeyEnabled: true`.
- `aws.s3.BucketPublicAccessBlock` — all four flags `true`.
- `aws.s3.BucketPolicy` — deny when `aws:SecureTransport` is `false` (TLS-only).
- `aws.s3.BucketLifecycleConfiguration` — `expire-noncurrent` (noncurrent 90d) and `abort-mpu` (7d).
- `aws.iam.Policy` — least-privilege state-backend access: `s3:ListBucket` + `s3:GetBucketLocation` on
  the bucket; `s3:GetObject`/`s3:PutObject`/`s3:DeleteObject` on `${bucket.arn}/*`;
  `s3:ListBucketVersions`/`s3:GetObjectVersion`; `kms:Decrypt`/`kms:GenerateDataKey`/`kms:DescribeKey`
  on the CMK.
- Outputs: bucket name, bucket ARN, `pulumi login` backend URL (`s3://<bucket>/bootstrap`), IAM policy
  ARN, KMS key ARN.
- Every resource gets `protect: true`, and `retainOnDelete: true` where the resource type supports it.

Config / wiring:

- `accountId` and `appName` come from explicit stack config: `new pulumi.Config().require(...)`, set
  in `Pulumi.prototype.yaml` (`appName: fst`).
- **Account guard:** the program calls `aws.getCallerIdentity()` at deploy time and asserts its
  `accountId` equals the configured `bootstrap:accountId`, throwing before creating resources if
  `AWS_PROFILE` points at the wrong account.
- `Pulumi.prototype.yaml` also holds `aws:region: ap-southeast-1`. Tags are `Project: <appName>`,
  `Env: prototype`, `Purpose: pulumi-state`.
- `AWS_PROFILE` selects the account at runtime; it is never written into stack config.
- Provider pinned in `infra/bootstrap/package.json` (add `@pulumi/aws`, currently absent) on the
  consolidated S3 API (v6+). `pnpm install` updates the root lockfile.
- The first apply uses the local backend + passphrase secrets provider (the CMK does not exist yet);
  after the runbook migration the CMK becomes the stack's secrets provider.
- `pulumi preview/up/destroy` stay OUT of turbo; only `lint`/`format`/`check-types` cover `infra/**`.

Repo housekeeping (RFC-mandated, minimal here): root `.gitignore` gains `**/.pulumi/` and
`*.state.json`, and the stale Terraform/Terragrunt block is removed.

### SDK naming note

We use the **consolidated S3 resource names** from modern `@pulumi/aws` (v6+): `aws.s3.Bucket` (the
former `BucketV2`) and the non-`V2` `BucketVersioning`, `BucketServerSideEncryptionConfiguration`, and
`BucketLifecycleConfiguration`. This is the RFC's design with the current (non-deprecated) SDK
identifiers.

## Files to modify

| File | Action |
| --- | --- |
| `infra/bootstrap/index.ts` | implement the prototype-stack resources + outputs (stack-generic) |
| `infra/bootstrap/Pulumi.prototype.yaml` | **new** — `accountId`, `aws:region`, tags |
| `infra/bootstrap/package.json` | add pinned `@pulumi/aws` dependency |
| `infra/bootstrap/Pulumi.yaml` | verify project name/runtime only (no backend pinned) |
| `infra/bootstrap/README.md` | **new** — the one-time bootstrap + state-migration runbook |
| `.gitignore` | add `**/.pulumi/` + `*.state.json`; remove stale Terraform/Terragrunt block |
| `pnpm-lock.yaml` | updated by `pnpm install` |
| `plans/2026-10-07-bootstrap-prototype-stack.md` | this plan (records the runbook) |

Out of scope (deferred): `infra/scripts/`, `docs/infra/`, `docs/index.md`, all CI workflows,
`infra/prototype/**`, `infra/production/**`, and the `staging`/`production` bootstrap stacks.

## Reuse

- Existing `infra/bootstrap` scaffold: `Pulumi.yaml`, `package.json` (`@infra/bootstrap`),
  `tsconfig.json`, `eslint.config.mjs`, `.gitignore` (already ignores `/.pulumi/`, `*.state.json`).
- `pnpm-workspace.yaml` already includes `infra/*`; `turbo.json` lint inputs already include
  `infra/**/*.ts`; root `format`/`format:fix` already glob `infra/**/*.{ts,js,mjs}`.
- `@repo/eslint-config` `./base` + `./rules` (infraRules) via existing `infra/*/eslint.config.mjs`.
- RFC code sketch in `rfc/2026-10-06-rfc-pulumi-iac-self-managed-state.md` (bucket/KMS/SSE/lifecycle).
- Plan structural model: `plans/2026-09-24-ci-workflow.md` (decisions, verified findings, steps).

## Steps

> After **EACH STEP**, run the code quality checks (`lint:fix`, `format:fix`, `check-types`) and commit
> the changes, including the plan-file checklist update.

- [x] Step 1 — **USER ACTION (pause here):** add pinned `@pulumi/aws` to
      `infra/bootstrap/package.json` and run `pnpm install`. The agent stops and waits for the user to
      do this; do not proceed until the dependency is installed.
- [x] Step 2 — Implement `infra/bootstrap/index.ts` (prototype resources, config-driven `accountId`,
      generic stack naming, `protect`/`retainOnDelete`, outputs).
- [x] Step 3 — Add `infra/bootstrap/Pulumi.prototype.yaml` (`accountId`, `aws:region: ap-southeast-1`,
      tags).
- [x] Step 4 — Repo housekeeping: `.gitignore` Pulumi entries + remove stale Terraform/Terragrunt block.
- [x] Step 5 — Finalize the Runbook below (real profile name) and verify `Pulumi.yaml`.
- [ ] Step 6 — Write the finalized Runbook into `infra/bootstrap/README.md` (the authoritative copy).

## Runbook: one-time prototype bootstrap and state migration

Run from `infra/bootstrap`. AWS profile is `starter-kit-prototype`; `AWS_PROFILE` is
never committed. Dummy account ID is `123456789012` (replace with real account ID from
`aws sts get-caller-identity` when deploying to actual AWS).

1. **Point the program at the prototype stack.** `Pulumi.prototype.yaml` already contains
   `config: { bootstrap:accountId: "123456789012", bootstrap:appName: fst, aws:region: ap-southeast-1 }`.
2. **First apply on the local backend** (creates the bucket; uses the passphrase secrets provider
   because the CMK does not exist yet):
   ```bash
   cd infra/bootstrap
   pulumi login file://.
   pulumi stack init prototype
   AWS_PROFILE=starter-kit-prototype pulumi up
   ```
   Capture the `stateBucketName` output (`pulumi stack output stateBucketName`).

   > **`file://.` vs `--local`.** Both select the local backend. `pulumi login --local` is shorthand for
   > `pulumi login file://~` and stores state under `~/.pulumi` (outside the repo).
   > `pulumi login file://.` stores it under `./.pulumi` in the project, which
   > `infra/bootstrap/.gitignore` already ignores. Either works; we use `file://.` to keep the throwaway
   > pre-migration state contained in the project directory.
3. **Export the local state:**
   ```bash
   pulumi stack export --file prototype.state.json
   ```
4. **Re-init the stack against the S3 backend and import:**
   ```bash
   pulumi login "s3://<bucket>/bootstrap"
   pulumi stack init prototype --secrets-provider "awskms://<cmk-arn>"
   pulumi stack import --file prototype.state.json
   ```
   `<bucket>` = the `stateBucketName` output (`<appName>-pulumi-state-<envSlug>-<accountId>`); `<cmk-arn>` =
   the `stateKeyArn` output. From here on the CMK is the stack's secrets provider.
5. **Delete the local state file** (`prototype.state.json`) — it is gitignored, but discard it explicitly.
6. **Verify the migrated backend:**
   ```bash
   pulumi stack ls
   AWS_PROFILE=starter-kit-prototype pulumi preview   # expect "no changes"
   ```
7. **Record the backend URL and account ID** for later projects: workload projects will log in with
   `pulumi login s3://<bucket>/prototype`.

This runbook is the migration deliverable (decision 3) and is committed as `infra/bootstrap/README.md`
(Step 6); a scripted helper and `docs/infra/` are follow-ups. The RFC's `staging`/`production` variants
repeat the same sequence with their own profiles, account IDs, and buckets.

## Verification

- **Static:** `lint:fix`, `format:fix`, `check-types` pass; `pulumi` is not reachable from `pnpm build`
  (no turbo wiring). `git status` shows no credentials or `*.state.json` staged.
- **Preview (local backend):** `AWS_PROFILE=<profile> pulumi preview` in `infra/bootstrap` shows exactly
  the expected resources — bucket, versioning, ownership controls, KMS key, SSE config, public-access
  block, TLS-only bucket policy, lifecycle config, IAM policy — and no unintended diffs.
- **Apply:** `pulumi up` creates the bucket; confirm with `aws s3api get-bucket-versioning` (Enabled),
  `get-bucket-encryption` (SSE-KMS with the CMK), `get-public-access-block` (all four true), and
  `get-bucket-lifecycle-configuration`.
- **Migration:** after the runbook, `pulumi login s3://<bucket>/bootstrap` + `pulumi stack ls` resolves
  the prototype stack, and a follow-up `pulumi preview` reports no changes (state migrated cleanly).
- **Manual:** user confirms the resources in the prototype AWS account under the real profile name and
  that no credentials are committed.
