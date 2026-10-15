# Prototype-serverless continuous deployment

## Context

The `prototype-serverless` Pulumi program in `infra/prototype-serverless/index.ts` builds and pushes a Docker image with `awsx.ecr.Image` when `IMAGE_TAG` is set, updates the `fst-prototype` Lambda (publishing a version), and moves its `live` alias. The supplied preview shows an image replacement, Lambda update, and alias update; the remaining Pulumi resources still need provider refresh/read access. The stack uses an S3 state backend and a KMS-backed secrets provider. Today `.github/workflows/ci.yml` runs quality checks on `develop` but does not deploy; the deployment will be added as a job in that workflow.

**Decided:** authenticate as a dedicated IAM user with an access key and an operator-attached inline policy; grant only updates to the already-provisioned stack; do not require a protected GitHub Environment. The checked-in JSON policy is a template: every infrastructure ARN placeholder must be replaced with a value from the deployed stack/bootstrap before attachment. Confirm the actual state-backend prefix (`infra/prototype-serverless/README.md` says `/app`, whereas `infra/bootstrap/README.md` suggests `/prototype`) and generated state KMS key ARN during operator setup.

## Approach

- Add a standalone, reviewed IAM identity-policy JSON document under `infra/prototype-serverless/`. An operator creates the dedicated IAM user and access key, substitutes **JSON-string placeholders** for specific infrastructure ARNs (e.g. `${ECR_REPOSITORY_ARN}`, `${LAMBDA_FUNCTION_ARN}`, `${LAMBDA_ALIAS_ARN}`, `${STATE_BUCKET_ARN}`, `${STATE_KMS_KEY_ARN}`, `${PULUMI_SECRETS_PROVIDER_KEY_ARN}`, and any generated resource ARNs needed for reads), then attaches the rendered document as that user's **inline policy**. The checked-in document must remain syntactically valid JSON but must never be attached with unresolved placeholders. Use deployed stack/bootstrap outputs and the actual backend prefix to resolve generated identifiers. Keep IAM user/key lifecycle and policy attachment outside the workload stack and CD workflow; do not introduce a separate IAM stack or role. Scope ECR push, Lambda image update/version publication, and alias update to the corresponding ARN placeholders; isolate `ecr:GetAuthorizationToken` and any other verified non-resource-scopable actions in small `Resource: "*"` statements. Include only required Pulumi refresh/read, S3 state, and KMS secrets-key operations; omit IAM/CloudFront writes, resource creation, and SSM runtime secret reads. Confirm required calls with a controlled run; the three visibly changed resources are not Pulumi's only reads.
- Add a `deploy` job to `.github/workflows/ci.yml` instead of creating a second workflow. Require the existing `build` job (which depends on lint, type-check, and format) and a changed-files detection job. Run `deploy` only if `github.event_name == 'push'`, `github.ref == 'refs/heads/develop'`, CI succeeded, and an app-affecting path changed. Use a positive deployment allowlist (`apps/**`, `packages/**`, `infra/**`, `Dockerfile.lambda`, `.dockerignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, and `.github/workflows/ci.yml`) with Markdown excluded, including Markdown within allowed directories. Retain the existing CI trigger/quality-check behavior. **The current workflow-level `paths-ignore` is insufficient for deployment:** it ignores only `.pi/**`, `docs/**`, and `**/*.md`, so a change solely to `services/mock-auth/config.yaml`, `docker-compose.yaml`, or `.husky/pre-commit` would still run CI and, without a job-level gate, deploy the app. Workflow-level filters cannot restrict just the deploy job. Ensure mixed commits and non-Markdown app assets/configuration still deploy.
- On a Docker-capable runner, check out the triggering commit, install pinned Node/pnpm/Pulumi tooling and frozen dependencies, configure AWS access-key credentials from GitHub Actions secrets, log in to the existing S3 Pulumi backend, select `prototype`, and run `pulumi up --yes` from `infra/prototype-serverless` with `IMAGE_TAG=${{ github.sha }}` in the deployment job environment. Use deployment concurrency so older commits cannot overwrite newer releases. Never run the Pulumi program without `IMAGE_TAG` during CD: repository-only mode can delete image-backed resources.
- Store the AWS access key ID/secret in GitHub Actions secrets and backend URL in an Actions variable; no protected GitHub Environment is required. Never commit credentials, create state/stack resources from the workflow, or silently grant permissions for future infrastructure changes.

## Files to modify

- `infra/prototype-serverless/prototype-serverless-cd-user-policy.json` — new valid-JSON identity-policy **template** with explicit ARN placeholders, to render and attach inline to the dedicated access-key user (not a role).
- `.github/workflows/ci.yml` — changed-files detection and a gated `deploy` job; preserve the existing CI jobs and triggers.
- `infra/prototype-serverless/README.md` — document CD prerequisites, IAM user/inline-policy and backend configuration, tag, trigger boundaries, and manual setup/rollback. Reconcile its stale statement about Lambda runtime SSM/KMS grants if touching that section.
- `plans/2026-10-15-prototype-serverless-cd.md` — record settled decisions and execution progress.

## Reuse

- `infra/prototype-serverless/index.ts`, `Pulumi.prototype.yaml`, and `README.md` for resource names, existing backend/stack instructions, and `IMAGE_TAG` behavior.
- `infra/bootstrap/index.ts` and `infra/bootstrap/bootstrap-user-policy.json` for state bucket/KMS permission patterns (not blanket workload permissions).
- `.github/workflows/ci.yml` for repository Node/pnpm and `develop` conventions; `Dockerfile.lambda` plus workspace manifests for image-affecting path filters.
- `rfc/2026-10-06-rfc-pulumi-iac-self-managed-state.md` for prior CD authentication proposal (access keys; not an implemented runner role).

## Policy review notes

The inline-policy template uses repository, unqualified function, `live` alias, execution-role, log-group, and individual CloudFront resource ARNs for workload operations and refresh reads. `ecr:GetAuthorizationToken`, `logs:DescribeLogGroups`, and `sts:GetCallerIdentity` are isolated wildcard-resource actions; S3 bucket listing is prefix-conditioned for the existing app and referenced secrets stacks, while object access is write-enabled only for app state. State SSE-KMS and Pulumi secrets-provider KMS grants use separate exact-key placeholders. Bucket-level location reads and object-level state access use different resource types. This policy intentionally excludes IAM/CloudFront writes, ECR repository creation, Lambda resource creation and permission writes, log writes, and SSM runtime-secret reads; any future infrastructure changes require a separate permission review. The JSON remains a template until every placeholder is resolved and tested against deployed stack resources.

## Steps

> After **each implementation step**, run the code-quality checks (`lint:fix`, `format:fix`, `check-types`) **through the `code-quality-checker` subagent only**, then commit that step's changes, including plan-file updates such as checking off the step. Planning itself changes no code.

- [x] Derive and add the smallest viable **placeholder-based** IAM user inline-policy document for updates to existing resources, including ECR authentication/push, Lambda update/version/alias operations, Pulumi provider reads, and S3/KMS backend access; ensure JSON syntax, action/resource support, and excluded write/create permissions are documented.
- [x] Add a `deploy` job and changed-files detection to `.github/workflows/ci.yml`. Gate deployment on a push to `develop`, successful CI, and an app-affecting non-Markdown change; use GitHub Actions access-key secrets, correct backend/stack selection, immutable SHA tag, and serialized deployment.
- [ ] **Documentation (last):** update `infra/prototype-serverless/README.md` with the dedicated IAM user/inline-policy setup, required ARN placeholder substitutions and how to find the actual state prefix/state KMS ARN, GitHub Actions variable/secret names, safeguards, trigger boundaries, and operator-run verification/rollback instructions. No IAM user, access key, or policy attachment is created by Pulumi or this workflow; reflect the agreed decisions in this plan.

## Verification

**Manual verification by the user/operator, not an implementation or deployment step:**

- Substitute every JSON placeholder, verify the resulting policy's action/resource compatibility and ARN scope, and test using the dedicated IAM user with a tagged `pulumi preview` and a controlled `pulumi up` on the existing stack. Check state and Pulumi secrets-key access; report missing permissions for a narrowly scoped policy revision if necessary.
- Check that CI still runs as before and that `deploy` runs only for qualifying pushes to `develop` after CI succeeds: app code/config/assets, `infra/**`, Docker/build/workspace changes, and `ci.yml` changes qualify; Markdown-only changes (even under allowed paths) and unrelated non-app changes such as `docker-compose.yaml` or `services/mock-auth/config.yaml` do not. Check mixed commits.
- Confirm that `IMAGE_TAG` is the triggering commit SHA, the ECR image is pushed, the Lambda version and `live` alias update, and concurrent releases cannot overwrite one another. No live AWS/GitHub deployment is claimed in this plan.
