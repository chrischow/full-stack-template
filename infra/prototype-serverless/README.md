# Prototype serverless deployment

This Pulumi project provisions an ECR repository, then builds and pushes a Lambda image with `awsx.ecr.Image` and provisions Lambda and CloudFront. It is a **prototype**, not a validated production platform.

## Prerequisites

- The `bootstrap` prototype stack must be initialised
- The `secrets` prototyep stack must be initialised with the required secrets
- AWS credentials to manage ECR, Lambda, and Cloudfront

## Initialisation

Login to the remote backend:

```bash
export AWS_PROFILE='<authorized-prototype-profile>'
pulumi login 's3://fst-pulumi-state-prototype-<account-id>/app'
```

Initialise the `prototype` stack:

```bash
pulumi stack init prototype --secrets-provider "awskms:///<cmk-arn>"
```

Confirm that it has been initialised, and select it:

```bash
pulumi stack ls
pulumi stack select prototype
```

Bootstrap the image repository by deploying **without an image tag**. This will simply create the ECR repo.

```bash
pulumi preview
pulumi up
pulumi stack output repositoryUrl
```

## Deploy New Image

> **Note:** After running this for the first time, DO NOT run `pulumi up` without an image tag because this will remove the Lambda and distribution.

Choose an immutable tag (e.g. commit SHA) for each image release and export it as `IMAGE_TAG` for both preview and update. Pulumi will build the image and push it to ECR. Keep `IMAGE_TAG` set for subsequent previews and updates; without it the program runs in repository-only mode and would remove the Lambda and distribution.

For the first run, this will create a Cloudfront distribution, log group, IAM role, and a Lambda function that is pointed at the newly-created image. For subsequent runs, deployments will build the image, point the Lambda function at the new image, and update the `live` alias.

```bash
export IMAGE_TAG=<new-immutable-tag>
pulumi preview
pulumi up
pulumi stack output imageUri
pulumi stack output distributionDomain
```

## Validation and known limits

- Build and locally smoke-test the Lambda container: check `/api/v1/health` (requires a reachable database), SPA deep links, built assets, missing assets (must not return HTML as 200), and API error paths. Ensure runtime configuration is available **before NestJS modules load**.
- Preview both bootstrap and image-backed phases against the intended backend/account/region. This repo does not include an automated deployment or AWS preview environment; an operator must run these checks with authorized credentials and a working Docker build environment for `up`.
- Once the **separate** runtime-secret-loading effort lands, test direct unauthenticated Function URL denial versus CloudFront success, Singapore access versus non-Singapore 403, API POST and cookie sessions, SPA routes, static and missing-asset behavior, cache/error semantics, startup logs, and a second image-tag deployment. An IAM-authenticated direct URL is not intended as a public origin; verify the deployed alias permissions remain distribution-scoped.
- The Lambda role currently has logging permissions but **no SSM/KMS runtime read grants**: the application retrieval effort must identify exact parameter names and the secrets project's SSM KMS key ARN before least-privilege grants can be added. Existing secrets use `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, while the backend expects `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY`; resolve that mapping in the separate application work. Infrastructure deployment by itself does not make the app start successfully.
- Set application domain, OAuth callback URL, passkey RP ID, and passkey origin to match the generated CloudFront hostname before authentication tests. Verify secure session-cookie and mutation behavior behind the HTTPS proxy.
- The CloudFront `SG` allowlist filters by viewer IP geolocation; it is not proof of a person's location or Singapore-only processing. Lambda suitability (startup, cold starts, DB connections, auth and load behavior) remains unvalidated. Do not treat successful provisioning as production readiness.
