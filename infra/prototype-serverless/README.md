# Prototype serverless deployment

This Pulumi project provisions an ECR repository, then an image-backed Lambda and CloudFront distribution. It is a **prototype**, not a validated production platform. Image publishing, runtime secret loading, release automation, and rollback are separate work.

## Target and prerequisites

- The committed `Pulumi.prototype.yaml` targets AWS account `699037282084` in `ap-southeast-1`. Confirm the target with the authorized operator before applying anything. The program checks the caller account and provider region.
- Complete `infra/bootstrap` first. Use the prototype state backend `s3://fst-pulumi-state-prototype-699037282084/prototype`, with access to its state bucket and the **external Pulumi KMS secrets-provider key** configured in `Pulumi.prototype.yaml`. This key is **not** the SSM encryption key managed by `infra/secrets`.
- Select an authorized AWS profile; the profile name is not fixed in this repository. Do not put credentials, plaintext secrets, or application secret values in Pulumi config, Docker builds, Lambda environment, or logs.
- Run Pulumi commands from `infra/prototype-serverless`. Review the selected stack, backend, caller identity, and preview before every update.

```sh
export AWS_PROFILE='<authorized-prototype-profile>'
aws sts get-caller-identity
pulumi login 's3://fst-pulumi-state-prototype-699037282084/prototype'
pulumi stack ls
pulumi stack select prototype
```

For a **new** stack only, use `pulumi stack init prototype --secrets-provider 'awskms:///arn:aws:kms:ap-southeast-1:699037282084:key/24d4ca90-0fd7-4bc6-8716-9e48d76dab9f'` instead of selecting an existing stack. Verify that this remains the approved provider before initializing; never initialize an existing stack again.

## Phase 1: bootstrap the image repository

Without `imageTag`, only the immutable-tag ECR repository is provisioned. Ensure no `imageTag` is already set in the selected stack before bootstrapping; **do not run an image-less update on a deployed stack**, because that would remove the Lambda and distribution.

```sh
pulumi preview
pulumi up
pulumi stack output repositoryUrl
```

Confirm the preview shows only ECR resources and no unexpected changes. Record the repository URL for publishing.

## Publish a Lambda-compatible image

From the **repository root**, build `Dockerfile.lambda` for `linux/amd64` (the Lambda is configured as `x86_64`) and push it to the repository URL. Use a new immutable tag for every release. For example, after substituting the output of `pulumi stack output repositoryUrl`:

```sh
export ECR_URI='<repositoryUrl-from-stack-output>'
export IMAGE_TAG='<new-immutable-tag>'
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 699037282084.dkr.ecr.ap-southeast-1.amazonaws.com
docker build --platform linux/amd64 -f Dockerfile.lambda -t "$ECR_URI:$IMAGE_TAG" .
docker push "$ECR_URI:$IMAGE_TAG"
```

These are operator examples, not a repository release script. Verify the image exists in the intended account and region before applying the tagged stack. Do not bake application secrets into the image.

## Phase 2: deploy the image-backed stack

Return to `infra/prototype-serverless`. Pulumi resolves the existing ECR tag to a digest and pins Lambda to that digest; it owns the published version and `live` alias. Never update Lambda code or the alias outside Pulumi.

```sh
pulumi preview --config "imageTag=$IMAGE_TAG"
pulumi up --config "imageTag=$IMAGE_TAG"
pulumi stack output imageDigest
pulumi stack output distributionDomain
```

Confirm the preview contains the expected digest, Lambda, IAM, Function URL, OAC, and distribution, with no plaintext credentials. CloudFront's generated hostname is the public origin; custom DNS, ACM, and WAF are out of scope. API, HTML, and assets are currently **uncached**. Enable immutable asset caching only after verifying the build's fingerprinted names and missing-asset responses.

For an image update, push another unused tag and repeat the tagged `preview` and `up`. Verify the digest and alias move to the new Pulumi-managed version without unrelated changes.

## Validation and known limits

- Build and locally smoke-test the Lambda container: check `/api/v1/health` (requires a reachable database), SPA deep links, built assets, missing assets (must not return HTML as 200), and API error paths. Ensure runtime configuration is available **before NestJS modules load**.
- Preview both bootstrap and image-backed phases against the intended backend/account/region. This repo does not include an automated deployment or AWS preview environment; an operator must run these checks with authorized credentials.
- Once the **separate** runtime-secret-loading effort lands, test direct unauthenticated Function URL denial versus CloudFront success, Singapore access versus non-Singapore 403, API POST and cookie sessions, SPA routes, static and missing-asset behavior, cache/error semantics, startup logs, and a second image-tag deployment. An IAM-authenticated direct URL is not intended as a public origin; verify the deployed alias permissions remain distribution-scoped.
- The Lambda role currently has logging permissions but **no SSM/KMS runtime read grants**: the application retrieval effort must identify exact parameter names and the secrets project's SSM KMS key ARN before least-privilege grants can be added. Existing secrets use `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, while the backend expects `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY`; resolve that mapping in the separate application work. Infrastructure deployment by itself does not make the app start successfully.
- Set application domain, OAuth callback URL, passkey RP ID, and passkey origin to match the generated CloudFront hostname before authentication tests. Verify secure session-cookie and mutation behavior behind the HTTPS proxy.
- The CloudFront `SG` allowlist filters by viewer IP geolocation; it is not proof of a person's location or Singapore-only processing. Lambda suitability (startup, cold starts, DB connections, auth and load behavior) remains unvalidated. Do not treat successful provisioning as production readiness.
