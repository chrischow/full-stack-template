# Prototype serverless stack

## Context

Build a deployable proof of concept of the Lambda Web Adapter candidate from `rfc/2026-10-13-rfc-prototype_stack.md`, without treating Lambda as a validated production choice. The existing root `Dockerfile` builds a combined NestJS/React image, while `infra/prototype-serverless/index.ts` is an empty Pulumi program. Add an ECR repository, Lambda function, and CloudFront distribution in the existing self-managed Pulumi setup (`rfc/2026-10-06-rfc-pulumi-iac-self-managed-state.md`). Image publishing is performed separately by the operator; release automation and rollback are out of scope.

## Approach

Leave `Dockerfile` intact and add root `Dockerfile.lambda`, reusing its build/package layout and adding a pinned Lambda Web Adapter extension with compatible startup/port. Use the existing `infra/prototype-serverless` project; configure prototype-account and region checks and the existing account-specific S3 backend/KMS secrets provider. Pulumi owns image updates: manage a private ECR repository and deploy a supplied `imageTag` (for example, `pulumi up --config imageTag=v1.2.3`) as an immutable, digest-resolved container image; if using an alias, Pulumi also owns its version and target. No external script should independently update Lambda code or alias state. Bootstrap by creating ECR without an image tag, publish the image separately, then run Pulumi with the tag to create Lambda and CloudFront. Use an IAM-authenticated Lambda Function URL behind CloudFront OAC and distribution-scoped invoke permissions. Keep `/api` and HTML uncached, forwarding required cookies/queries, and cache only verified fingerprinted assets; preserve SPA deep links and actual errors without global 403/404 rewrites. Runtime secret retrieval is a separate application effort: do not implement it in this plan or put secrets in the image, Lambda environment managed by Pulumi, or plaintext Pulumi state. Deployment can provision infrastructure before that effort lands, but successfully starting/invoking the application requires the app to obtain its required environment values before importing NestJS modules. Add CloudFront's native geographic restriction with an allowlist for Singapore (`SG`), not AWS WAF; this is IP-based access filtering, not proof of user location or Singapore-only processing. Use CloudFront's generated domain; custom DNS and ACM belong to a separate effort. Verify callback/passkey origins are compatible with the generated domain before testing authentication.

## Files to modify

- `Dockerfile.lambda` (new Lambda-specific image; preserve `Dockerfile`)
- `infra/prototype-serverless/index.ts` (ECR, execution role, Lambda, Function URL, CloudFront with native Singapore geographic restriction)
- `infra/prototype-serverless/package.json`, `pnpm-lock.yaml` (add Pulumi AWS dependency)
- `infra/prototype-serverless/Pulumi.prototype.yaml` and deployment README (account/region/stack configuration, ECR bootstrap, image publish and `imageTag` update instructions)
- No backend secret-loading changes, WAF resources, release automation, rollback scripts, custom DNS, or ACM in this task

## Reuse

- `Dockerfile` — existing pnpm/Turbo prune and combined backend/frontend packaging pattern.
- `apps/backend/src/main.ts` and `apps/backend/src/app.module.ts` — HTTP listener (`APP_PORT` must match Web Adapter port) and existing API/static/SPA routing.
- `infra/bootstrap/index.ts` and `infra/secrets/` — existing account/region/state/KMS and SSM conventions; SSM parameter values are not automatically supplied to `process.env`. Backend expects `SES_ACCESS_KEY_ID` and `SES_SECRET_ACCESS_KEY` (`apps/backend/src/env/schema.ts`); the secrets project instead defines `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (`infra/secrets/index.ts`). The separate application secret-loading effort must resolve that mapping. Do not duplicate secret values in the image or Pulumi state.
- Root `lint:fix`, `format:fix`, `check-types` scripts and conventional-commit conventions.

## Steps

**After EACH STEP, code quality checks should be run, and changes should be committed.** Include updates to this plan (for example, marking the step complete) in that step's commit. Use `pnpm lint:fix`, `pnpm format:fix`, and `pnpm check-types` after every code change.

- [ ] Record scope boundaries and prerequisites: app-owned runtime secret retrieval and SES-name mapping must land before live app verification; no WAF, custom DNS/ACM, or release/rollback automation. Document deferred Lambda-viability validation.
- [ ] Add and validate `Dockerfile.lambda` with the Web Adapter; align `APP_PORT` and `AWS_LWA_PORT`, preserve bundled frontend assets and existing container behavior.
- [ ] Add the ECR repository, Pulumi AWS dependency, prototype stack/account/region safeguards, and no-image bootstrap mode. Export ECR repository URL so the operator can push an immutable tagged image.
- [ ] Resolve `imageTag` to an existing ECR digest, then configure Lambda image, execution IAM, region/runtime settings, and only the scoped secret-read/decrypt permissions required by the separate application retrieval effort (no Pulumi-managed secret values). If using a version/alias, manage both solely with Pulumi and attach the IAM-authenticated Function URL to the alias.
- [ ] Add CloudFront OAC and restricted Function URL invocation, uncached API and HTML behavior, and only validated immutable asset caching. Set native geographic restrictions to allow only Singapore; do not provision WAF or broad 403/404-to-HTML rewrites.
- [ ] Document two-phase ECR/image/stack deployment, `pulumi up --config imageTag=...`, dependency on separate runtime-secret loading and callback/passkey origin configuration, and checks of origin isolation, geographic restriction, and subsequent image-tag updates.

## Verification

- Run `pnpm lint:fix`, `pnpm format:fix`, and `pnpm check-types` after each implementation step and verify the completed codebase builds.
- Build and smoke-test the Lambda container locally, including `/api/v1/health` (requires DB), SPA deep links, static assets, missing assets and API error paths where prerequisites permit; verify runtime environment is available before backend modules load.
- Run Pulumi preview against the intended prototype account/backend both without an image tag (ECR-only bootstrap) and with a published immutable image tag (Lambda/CloudFront). Verify account/region isolation, correct image digest, and no plaintext credentials.
- After the separate application secret-loading effort supplies startup configuration, test direct Function URL denial versus CloudFront success, Singapore access versus non-Singapore 403, API cookie sessions and POST requests, correct cache/error behavior, logs/startup, and a second Pulumi-managed image-tag update. Infrastructure deployment alone cannot establish app readiness; record any Lambda suitability validations deferred by the agreed scope.
