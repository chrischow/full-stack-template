# Pulumi IaC with Self-Managed State

Date: 2026-10-06

## Problem Context

This repo is a starter kit intended for two modes of use: rapid prototyping and production. The
stated philosophy is that with capable AI coding agents we no longer have to accept sloppy
prototypes — a harness that provides strong security and quality guardrails, clear guidance, and
consistent boundaries lets an agent produce production-grade code from the start. The application
layer reflects this: contract-first oRPC + Zod in `packages/api-contract`, a Zod-validated
`EnvSchema` in the backend, a single distroless container, and GitHub Actions quality gates.

Infrastructure is the missing piece. Today the repo has **no IaC of any kind** —
`docs/index.md` has an empty `(WIP) Infra` section, there is no `infra/` directory, no Pulumi or
Terraform code, and no deployment workflow. The only trace of a prior IaC choice is a vestigial
Terraform/Terragrunt block in `.gitignore`. Because provisioning is greenfield, we get to choose
the tool and the state model deliberately rather than inherit one.

Pulumi (TypeScript) is the chosen tool, consistent with the rest of the repo: LLMs are well trained
on TypeScript and the Pulumi API is fully typed. The prototype IaC and the production IaC must
live in **the same repository** so that the switch from MVP to production is a stack/config change,
not a re-platform. State is self-managed in S3 (no Pulumi Cloud dependency) so that the org keeps
control of state, credentials, and blast radius.

The concrete shape the user has asked for:

- Two Pulumi projects: a lightweight **prototype** project (prototype AWS account, API-key authn)
  and a production-grade project for **staging** and **production** in the org's AWS accounts (SSO).
- Self-managed state in S3, one bucket per project per environment.
- A **bootstrap** project with three stacks — `prototype`, `staging`, and `production` — that
  creates the state buckets and only the minimal supporting resources required for them to serve as
  Pulumi state buckets.
- `AWS_PROFILE` selects the active identity: `app-prototype` (access key), `org-app-stg` and
  `org-app-prd` (SSO).
- `pulumi up` for the prototype runs in a **GitHub runner**; `pulumi up` for production runs in a
  **GitLab runner**.

Assumptions worth stating because they shape the design (see Open Questions at the end of
`Proposed Solution`):

- The org uses **separate AWS accounts for staging and production**, in addition to the prototype
  account. The bootstrap therefore creates three state buckets, one per account, and each
  `production` stack uses the bucket in its own account.
- The default region is `ap-southeast-1`, matching `AWS_REGION`'s default in
  `apps/backend/src/env/schema.ts`.
- SSO is an interactive human login. It cannot be driven unattended by a GitLab runner, so
  production CI uses a machine identity supplied by self-hosted workers running inside each target
  account, while humans keep SSO locally. This is called out explicitly in the options below.

## Goals

- Provide self-managed Pulumi state in S3 that is versioned, encrypted, access-controlled, and
  locked, per project and per stack.
- Keep a hard boundary between prototype and production infrastructure by putting them in separate
  Pulumi projects with separate state buckets and separate credentials.
- Make local developer usage predictable through `AWS_PROFILE`, matching the profiles the user
  already intends to configure.
- Make CI usage production-grade: scoped credentials, preview-before-apply, manual approval for
  live changes.
- Keep prototype and production code in one repo and one toolchain so promoting an MVP does not
  require a migration project.
- Keep the bootstrap surface minimal — a state bucket plus only what is required to make it a valid
  Pulumi state bucket — so it is quick to audit and hard to misuse.
- Document the model under `docs/`, replacing the empty `(WIP) Infra` section.

## Requirements

### Functional requirements

- A `bootstrap` Pulumi project with three stacks, `prototype`, `staging`, and `production`. Each
  stack creates exactly one S3 bucket in its target account, plus the minimal supporting resources
  required for that bucket to function as a Pulumi state backend:
  - bucket versioning enabled;
  - server-side encryption enabled by default with a customer-managed KMS key per account;
  - full public-access block and an ownership-enforced / ACL-disabled configuration;
  - a bucket policy that denies non-TLS requests;
  - a lifecycle configuration (expire noncurrent versions, abort incomplete multipart uploads);
  - an IAM policy scoped to the state bucket that can be attached to the prototype user and to the
    per-environment CI roles, granting the exact S3 actions Pulumi's S3 backend needs;
  - outputs for the bucket name/ARN, the `pulumi login` backend URL, and the KMS key.
- A `prototype` Pulumi project that deploys to the prototype AWS account using the `app-prototype`
  profile and stores state in the prototype state bucket.
- A `production` Pulumi project with `staging` and `production` stacks that deploy to the staging
  and production AWS accounts using the `org-app-stg` and `org-app-prd` SSO profiles respectively,
  each storing state in its own account's bucket.
- State buckets are consumed via `pulumi login s3://…` (self-managed S3 backend), including Pulumi's
  built-in state locking, with no Pulumi Cloud account.
- Local authentication is driven by `AWS_PROFILE`; no AWS credentials are written into Pulumi stack
  config or committed to the repo.
- The prototype `pulumi up` runs in GitHub Actions; the production `pulumi preview`/`pulumi up` runs
  in GitLab CI.
- Pulumi programs, bootstrap runbook, and day-to-day commands are documented under `docs/infra/`
  and linked from `docs/index.md`.

### Non-functional requirements

- **Type safety and consistency.** Pulumi code is TypeScript, linted/formatted/type-checked with the
  existing repo toolchain (`lint`, `format`, `check-types`), and structured to be legible to an LLM.
- **Least privilege.** CI identities and the prototype state policy grant only the actions required
  for the specific bucket/prefix; production state access is separate from prototype.
- **Encryption.** State is encrypted at rest with a customer-managed KMS key **per account** and in
  transit; each stack uses its account's key as the Pulumi secrets provider rather than a shared
  passphrase.
- **No secrets in git.** Stack config files may be committed but secret values are set with
  `pulumi config set --secret` and encrypted; `.env` variants remain gitignored.
- **Recoverability.** Versioning plus a lifecycle policy allow point-in-time recovery of state while
  bounding storage growth.
- **Isolation.** Prototype, staging, and production never share an AWS account, profile, or state
  bucket; staging and production live in separate accounts with separate buckets and distinct roles.
- **Reproducibility.** Pulumi CLI and provider versions are pinned; CI runs a frozen install.
- **Low bootstrap cost.** The bootstrap project creates state, not workloads; its footprint is a
  bucket (plus a KMS key and IAM policy) per account.
- **Auditability.** Bucket access and CI role assumption are visible via CloudTrail; apply steps
  require review.

## Options

### Option 1: Two Pulumi projects plus a minimal bootstrap project, self-managed S3 state

One repo, three Pulumi projects: `bootstrap` (stacks `prototype`, `staging`, `production`),
`prototype` (in the prototype account), and `production` (stacks `staging`, `production`). The
bootstrap creates one state bucket per account; every other project logs into its bucket with
`pulumi login s3://…`. Locally, `AWS_PROFILE` selects `app-prototype` or the
`org-app-stg`/`org-app-prd` SSO profiles; in CI the GitHub runner uses prototype access keys and the
GitLab runner runs on a self-hosted worker inside the target account. Prototype and production code share nothing except the
repo and conventions, and the state store is a separate, minimal, long-lived unit whose lifecycle is
decoupled from any workload.

This option satisfies all the explicit constraints (two workload projects, self-managed S3 state, a
bootstrap project, profile split, two CI platforms) while keeping the state store isolated from the
things it stores state for.

### Option 2: Projects organized by environment, with bootstrap folded in (no bootstrap project)

Two Pulumi projects, one per mode: a `prototype` project that contains the prototype state bucket
*and* the prototype infrastructure, and a `live`/`production` project whose `staging` and
`production` stacks each contain their own account's state bucket *and* infrastructure. There is no
separate bootstrap project; each environment/stack is self-contained and owns its state bucket.

This is the simplest mental model (one project, one environment) and removes the cross-project
bootstrap ordering. However, it reintroduces the chicken-and-egg problem in every stack, couples the
lifecycle of the state bucket to the lifecycle of the workloads it stores (a `pulumi destroy` on the
stack targets the bucket that holds its own state, relying on `protect`/`retainOnDelete` to
survive), and duplicates the bootstrap resources and hardening logic per environment. It also makes
the state store harder to audit in isolation, because it is no longer the only thing the project
manages. Rejected because decoupling the state store from workload teardown is worth the extra
project.

### Option 3: A single Pulumi project with `prototype`/`staging`/`production` stacks

One Pulumi project, one state bucket, three stacks. This is simpler to navigate and reduces
duplication of Pulumi boilerplate. However, prototype and production code, dependencies, and
credentials live in the same project, so a prototype permission mistake or a bad stack config can
reach production infrastructure; the prototype account would need access to a bucket that also holds
production state (or a prefix policy that is easy to get wrong). It also does not deliver the hard
prototype/production boundary the user asked for, and it assumes the prototype infrastructure is the
same shape as staging/production — whereas the prototype is expected to diverge (fewer managed
services, looser retention, disposable resources) while staging and production are mirrors of each
other. Rejected on isolation and divergence grounds.

### Option 4: Self-managed state but in Pulumi Cloud (managed backend)

Use Pulumi Cloud's free/paid tiers for state, RBAC, and CI integrations instead of S3, keeping the
two-project structure and dropping the bootstrap project. This removes all bucket and state-locking
work and gives first-class concurrency and audit features. But it contradicts the explicit
"self-managed state" requirement, introduces a third-party dependency holding infrastructure state
and (unless ESC is used) secrets, and adds a vendor whose access model must be reviewed. Rejected as
it does not meet the stated requirement, though worth revisiting as a future option if the team
wants managed concurrency and policy.

### Option 5: Terraform with an S3 backend

Keep the `apps/` and `packages/` layout and provision infrastructure with Terraform (as the
vestigial `.gitignore` block suggests). Terraform has broader industry familiarity and mature S3
state tooling (including DynamoDB locking, which is no longer required on modern versions).
However, HCL is not TypeScript, so the type/language leverage that motivated Pulumi is lost, and the
repo would carry two ecosystems. Rejected because it contradicts the deliberate Pulumi/TypeScript
choice.

## Proposed Solution

Option 1 is selected because it meets every stated requirement — separate accounts per environment,
self-managed S3 state with one bucket per account, a minimal and independently auditable bootstrap
project, and two CI platforms — while preserving the repo's "prototype and production share one repo
and one toolchain" philosophy. Option 2 is close, and its simplicity is appealing, but keeping the
state bucket out of the workload projects is worth the extra project: the state store must outlive
the workloads, must not be destroyed by a workload teardown, and should be reviewable on its own.

### Repository layout

Add an `infra/` tree where each directory is an independent Pulumi project (its own `Pulumi.yaml`,
entry point, and stack config):

```
infra/
  bootstrap/          # project: creates the state buckets (stacks: prototype, staging, production)
    Pulumi.yaml
    Pulumi.prototype.yaml
    Pulumi.staging.yaml
    Pulumi.production.yaml
    index.ts
  prototype/          # project: prototype environment (stack: prototype)
    Pulumi.yaml
    Pulumi.prototype.yaml
    index.ts
  production/         # project: staging + production (stacks: staging, production)
    Pulumi.yaml
    Pulumi.staging.yaml
    Pulumi.production.yaml
    index.ts
  scripts/            # bootstrap/migration helpers, shared docs snippets
```

`infra/*` is added to `pnpm-workspace.yaml` so each project shares the root lockfile, Prisma-free
dependency graph, and the existing `lint`/`format`/`check-types` tooling. Operations (`pulumi
preview`/`up`/`destroy`) are **not** wired into `turbo`; they are run explicitly so a normal `pnpm
build` never touches cloud accounts. If workspace integration proves noisy (for example, if Pulumi's
Node runtime dislikes pnpm's symlinked layout), the fallback is to keep `infra/*` outside the
workspace and install each project independently — a local change that does not affect the state
or credential design.

`.gitignore` gains the Pulumi local artifacts (`**/.pulumi/`, `*.state.json`), while
`Pulumi.yaml`, `Pulumi.<stack>.yaml`, and `index.ts` are committed. The stale Terraform/Terragrunt
block is removed as part of this work.

### Project, stack, profile, and state mapping

| Project | Stack | AWS account | Profile (local) | CI runner | State location |
| --- | --- | --- | --- | --- | --- |
| `bootstrap` | `prototype` | prototype | `app-prototype` | local/one-off | `s3://<prototype-bucket>/bootstrap` |
| `bootstrap` | `staging` | staging | `org-app-stg` | local/one-off | `s3://<staging-bucket>/bootstrap` |
| `bootstrap` | `production` | production | `org-app-prd` | local/one-off | `s3://<prod-bucket>/bootstrap` |
| `prototype` | `prototype` | prototype | `app-prototype` | GitHub Actions | `s3://<prototype-bucket>/prototype` |
| `production` | `staging` | staging | `org-app-stg` | GitLab CI | `s3://<staging-bucket>/production` |
| `production` | `production` | production | `org-app-prd` | GitLab CI | `s3://<prod-bucket>/production` |

Bucket names embed the account ID to guarantee global uniqueness, e.g.
`fst-pulumi-state-prototype-<accountId>`, `fst-pulumi-state-staging-<accountId>`, and
`fst-pulumi-state-prod-<accountId>`. Because staging and production live in separate accounts, each
production stack has its own bucket and credentials; there is no shared live bucket and no
cross-environment state access to police.

### Bootstrap project: state buckets as the only artifacts

Each bootstrap stack creates exactly one bucket plus the minimum required to make it a valid Pulumi
state backend. Using `@pulumi/aws` (classic), the resources are illustrative of the following:

```ts
// infra/bootstrap/index.ts (excerpt, per stack)
const bucket = new aws.s3.BucketV2("state", {
  bucket: `fst-pulumi-state-${stackName}-${accountId}`,
  forceDestroy: false,          // never destroy state implicitly
  tags: { Project: "fst", Env: stackName, Purpose: "pulumi-state" },
});

new aws.s3.BucketVersioningV2("state-versioning", {
  bucket: bucket.id,
  versioningConfiguration: { status: "Enabled" },
});

const stateKey = new aws.kms.Key("state-key", {
  description: `Pulumi state encryption for ${stackName}`,
  enableKeyRotation: true,
  deletionWindowInDays: 30,
});

new aws.s3.BucketServerSideEncryptionConfigurationV2("state-sse", {
  bucket: bucket.id,
  rules: [{
    applyServerSideEncryptionByDefault: {
      sseAlgorithm: "aws:kms",
      kmsMasterKeyId: stateKey.arn,
    },
    bucketKeyEnabled: true,
  }],
});

new aws.s3.BucketPublicAccessBlock("state-pab", {
  bucket: bucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

// TLS-only bucket policy (deny aws:SecureTransport=false)

new aws.s3.BucketLifecycleConfigurationV2("state-lifecycle", {
  bucket: bucket.id,
  rules: [
    { id: "expire-noncurrent", status: "Enabled",
      noncurrentVersionExpiration: { noncurrentDays: 90 } },
    { id: "abort-mpu", status: "Enabled",
      abortIncompleteMultipartUpload: { daysAfterInitiation: 7 } },
  ],
});

// IAM policy granting the exact set the Pulumi S3 backend needs:
//   s3:ListBucket, s3:GetBucketLocation            on the bucket
//   s3:GetObject, s3:PutObject, s3:DeleteObject    on <bucket>/*
//   s3:ListBucketVersions / s3:GetObjectVersion    for versioned recovery
// plus kms:Decrypt / kms:GenerateDataKey / kms:DescribeKey on the account's state key.
```

Every resource is marked `protect: true` and, where supported, `retainOnDelete: true`, so an
accidental `pulumi destroy` cannot silently delete the state store. The stack outputs the bucket
ARN, the `pulumi login` URL, and the IAM policy ARN for use by the other projects and by CI.

Every account — prototype, staging, and production — has its own customer-managed KMS key from day
one. The key encrypts that account's state bucket with SSE-KMS and doubles as the secrets provider
for the stacks that live there (`pulumi stack init --secrets-provider awskms://<key-arn>`), so no
shared passphrase is ever used. The bootstrap stacks themselves still use the local/passphrase
secrets provider for the very first apply because their key does not exist yet at that point; after
migration their state holds only bucket, key, and policy metadata.

### Bootstrapping its own state (the chicken-and-egg)

The bootstrap project cannot store its state in the bucket it is about to create, so the first apply
is done on a local backend and then migrated into the created bucket. This is a one-time, documented
procedure, not part of normal operation:

1. `cd infra/bootstrap`
2. `pulumi login file://.` (local backend), `pulumi stack init prototype`,
   `AWS_PROFILE=app-prototype pulumi up` → creates the prototype bucket.
3. `pulumi stack export --file prototype.state.json`.
4. `pulumi login s3://<prototype-bucket>/bootstrap`, `pulumi stack init prototype`,
   `pulumi stack import --file prototype.state.json`; delete the local file.
5. Repeat for the `staging` and `production` stacks with `AWS_PROFILE=org-app-stg` and
   `AWS_PROFILE=org-app-prd` and the corresponding buckets.

From then on all three bootstrap stacks are managed from S3 like every other project. The helper lives
in `infra/scripts/` so the sequence is copy-pasteable and reviewable. Keeping this in the repo
(rather than hand-creating buckets in the console) preserves the "everything is code" guarantee and
makes the state store reproducible if it is ever lost.

### Authentication

**Local.** Profiles are configured once as the user described: `app-prototype` with an access key,
and `org-app-stg` / `org-app-prd` as SSO profiles. Developers export `AWS_PROFILE` (or pass
`--profile` to the AWS CLI) and run Pulumi; the AWS provider resolves credentials through the SDK
default chain, so `AWS_PROFILE` is the single switch. No `aws:profile` is written into stack config,
keeping identities out of the repo. The bootstrap runs target one account at a time, selected by the
matching profile (`app-prototype`, `org-app-stg`, or `org-app-prd`). The `org-app-stg` and
`org-app-prd` profiles own the staging and production state-bucket runs respectively.

**GitHub Actions (prototype).** The prototype account uses access-key authn, matching the stated
requirement. Repository/environment secrets provide `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`;
the workflow configures the `app-prototype` profile (via `aws-actions/configure-aws-credentials@v4`
or by writing `~/.aws/credentials`) and sets `AWS_PROFILE=app-prototype`, so CI mirrors local
behavior. The bucket and credentials are prototype-only, so blast radius is contained. The IAM user
behind the key is scoped to what the sandbox stack needs, and the key is rotated on a regular
cadence. OIDC federation is deliberately out of scope: the credential only ever reaches a disposable
prototype account, so the extra OIDC provider and trust-policy setup is not justified.

**GitLab CI (production).** AWS SSO for humans is interactive and short-lived, so it is not used in
CI. Instead, the plan is to run GitLab runner workers self-hosted in the staging and production
accounts: each worker's EC2 instance profile (or EKS pod identity / node role) supplies short-lived
credentials for its own account, and no long-lived keys or SSO cache ever sit on the runner. Because
the worker lives in the target account, jobs use the AWS SDK default credential chain directly, and
runner tags ensure only staging jobs land on the staging worker and only production jobs on the
production worker. Humans keep SSO locally. Each worker's instance profile is scoped to a dedicated
deployment role for its environment rather than a broad admin role. OIDC federation is explicitly
out of scope: the in-account worker already supplies short-lived, account-scoped credentials, so a
separate `sts:AssumeRoleWithWebIdentity` step-down would add machinery without changing the trust
boundary we rely on.

### State backend and secrets

- Backend: `pulumi login s3://<bucket>/<prefix>` per project. Pulumi's S3 backend performs its own
  locking, so no DynamoDB table is needed — one fewer supporting resource and one fewer thing to
  break.
- Secrets: every stack uses its account's customer-managed KMS key as the secrets provider (no
  shared passphrase). Non-secret config (region, app name, tags) is committed in
  `Pulumi.<stack>.yaml`; secret values are set with `pulumi config set --secret`.
- Region: `aws:region: ap-southeast-1` in stack config, matching the application default. Any
  divergence is an explicit, reviewable change rather than an environment surprise.

### CI pipelines

**Prototype — GitHub Actions.** A new workflow (for example `.github/workflows/deploy-prototype.yml`,
separate from the existing quality-gate `ci.yml`) runs on `workflow_dispatch` and on pushes that
touch `infra/prototype/**`, using a GitHub Environment named `prototype`. Steps: checkout → Node 22
+ pnpm (cached) → `pnpm install --frozen-lockfile` → configure `app-prototype` credentials → install
a pinned Pulumi CLI → `pulumi login $PULUMI_PROTOTYPE_BACKEND_URL` → `pulumi stack select prototype`
→ `pulumi up --yes`. The existing `ci.yml` is extended only to lint/type-check/format the new
`infra/**` packages; it must not gain any cloud steps.

**Production — GitLab CI.** A root `.gitlab-ci.yml` (with the specifics in an included
`.gitlab/ci/production.yml`) defines `plan` and `apply` jobs for `staging` and `production`. Jobs
run on self-hosted runner workers hosted in the corresponding account, so the AWS SDK picks up the
worker's instance-profile credentials for that account, and runner tags ensure only jobs for an
environment run on that environment's worker. `plan` runs `pulumi preview` on merge requests;
`apply` is `when: manual` and restricted to protected branches via GitLab protected environments,
with `staging` and `production` as separate environments. Each job sets `PULUMI_BACKEND_URL` and the
target stack and inherits credentials from its worker's scoped instance profile. Because the repo is
primarily GitHub-hosted, the GitLab pipeline is scoped with `rules:` so it only runs in the GitLab
project.

Neither pipeline stores secrets in the repo; all credentials come from the platform secret stores
(GitHub Environments, GitLab CI variables) or, for production, from short-lived instance-profile
credentials supplied by the in-account worker.

### Guardrails baked into the design

- State buckets are protected and retained; the bootstrap project never manages workloads.
- Prototype, staging, and production each use a different AWS account, profile, and state bucket;
  staging and production use different stacks, CI roles, and manual approvals.
- Production CI runs on self-hosted workers inside each target account and uses short-lived,
  environment-scoped instance-profile credentials; prototype uses scoped access keys.
- OIDC federation is out of scope for both modes. The sandbox account's blast radius does not justify
  it, and the staging/production account boundary already supplies the isolation that self-hosted
  worker instance profiles rely on.
- State is versioned, encrypted, and subject to a lifecycle policy.
- `infra/**` changes flow through the same lint/format/type-check gates as application code, and
  infrastructure changes are previewed before apply.
- New environment variables (for example, `PULUMI_BACKEND_URL`, role/account IDs) are added to the
  relevant config docs rather than hardcoded.

### Documentation

Create `docs/infra/` covering: setting up `app-prototype`/`org-app-stg`/`org-app-prd`, running the
one-time bootstrap and state migration, day-to-day `preview`/`up` commands per environment, and how
the two CI pipelines authenticate. Populate the empty `(WIP) Infra` section in `docs/index.md` with
links to these documents. After implementation, run `lint:fix`, `format:fix`, and `check-types` per
`AGENTS.md`.

### Tradeoffs and limitations

- The bootstrap project now spans three accounts and three stacks, so the one-time migration runs
  three times. This is slightly more setup than a single live bucket, but it buys account-level
  isolation between staging and production and avoids any cross-environment state sharing.
- Migrating the bootstrap state by hand is unavoidable given the requirement that the project create
  its own bucket. The helper script and runbook reduce it to a copy-paste operation, and it happens
  once per account.
- Production CI uses in-account runner identities rather than the SSO profiles used locally. This is
  a deliberate divergence: SSO is a human login and is not suitable for unattended runners. The
  profile names remain the local interface, so the mental model ("staging = `org-app-stg`") is
  preserved. The accepted tradeoff is that a worker's instance profile is scoped to an environment
  account rather than an individual stack; if per-stack least privilege later becomes a hard
  requirement, the trigger to revisit is an OIDC step-down, which is deliberately not built now.
- Adding `infra/*` to the pnpm workspace couples infrastructure dependency installation to the
  existing install step. If that causes friction, the documented fallback is independent installs
  per project, which does not affect state or security.

