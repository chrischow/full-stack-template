# Prototype serverless deployment

This Pulumi project provisions an ECR repository, then builds and pushes a Lambda image with `awsx.ecr.Image` and provisions Lambda and CloudFront. It is a **prototype**, not a validated production platform.

## Prerequisites

- The `bootstrap` prototype stack must be initialised
- The `secrets` prototype stack must be initialised with the required secrets
- AWS credentials to manage ECR, Lambda, and CloudFront

## Initialisation

Login to the remote backend:

```bash
export AWS_PROFILE='<authorized-prototype-profile>'
pulumi login 's3://<verified-state-bucket>/<verified-app-backend-prefix>'
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

## Continuous deployment on `develop`

The `deploy` job in `.github/workflows/ci.yml` is for **updates to an already-provisioned image-backed `prototype` stack**, not initialisation. First deploy the repository, Lambda, `live` alias, CloudFront, IAM role, and secrets stack with an operator identity using the manual steps above. Configure CD **before** pushing the workflow change to `develop`; without the required credentials/backend, a qualifying push reaches the deploy job but cannot update the stack. No IAM user, access key, inline-policy attachment, state bucket, or Pulumi stack is created by this workflow or the prototype-serverless Pulumi project.

### Set up the dedicated deployer

1. As an authorised operator, retrieve the existing bootstrap stack outputs `stateBucketName`, `stateBucketArn`, and `stateKeyArn` (`infra/bootstrap/index.ts`). Log in to its **existing** `/bootstrap` backend and select `prototype` before running `pulumi stack output <name>` from `infra/bootstrap`. `stateKeyArn` is the S3 state encryption key, **not** the Pulumi secrets-provider key in `Pulumi.prototype.yaml` and not the secrets project's SSM key.
2. Confirm the actual `/app` backend URL and S3 keys with an authorised read-only identity before granting access. The app and referenced secrets stack state are now in `/app`; older bootstrap and secrets documentation describes other backend prefixes. Do not infer S3 object-key prefixes from backend URLs or historical documentation. For the bucket obtained above, inspect `aws s3api list-objects-v2 --bucket '<state-bucket-name>' --query 'Contents[].Key' --output text` and check the existing backend login/stack selection used by operators. Confirm the exact metadata and referenced secrets checkpoint object keys, and that this Pulumi backend stores the app project's checkpoints, history, backups, and locks under `.pulumi/{stacks,history,backups,locks}/prototype-serverless/`. The lock directory may not exist until an update runs. The template grants writes only to these four project directories and deletion only to project locks; if the deployed backend uses a different layout, adjust the ARN patterns before attaching the policy. The separate secrets checkpoint grant must remain read-only for the `StackReference` in `index.ts`. Bucket listing still uses the broader `/app` prefix and can reveal other key names; confirm Pulumi's listing requests before narrowing it.
3. Using the operator's credentials, log in to the verified app backend from `infra/prototype-serverless`, select the **existing** `prototype` stack, and read `pulumi stack output repositoryArn`. Obtain the remaining physical ARNs from the deployed stack (for example, filter `pulumi stack export` to just the ARN/ID outputs of the IAM role, CloudFront distribution/OAC/origin-request-policy, Lambda function/alias, and log group). The full stack export can contain secrets: do not save or share it. Check ARN partition, account, region, physical names, and the `live` qualifier; don't substitute Pulumi logical names for generated physical identifiers.
4. Create a **dedicated IAM user** and access key outside Pulumi, using authorised operator credentials. Render `prototype-serverless-cd-user-policy.json` by replacing **every JSON-string `${...}` placeholder** with the confirmed value below, validate the rendered document as JSON and review IAM action/resource compatibility, then attach it as this user's **inline policy**. Never attach the template with unresolved placeholders, commit the rendered policy, or grant the user unrelated IAM/CloudFront writes. Keep the key private and rotate/revoke it if exposed.

| Template placeholder(s) | Substitute with |
| --- | --- |
| `ECR_REPOSITORY_ARN` | Existing repository ARN from `repositoryArn`. |
| `LAMBDA_FUNCTION_ARN`, `LAMBDA_ALIAS_ARN` | Existing unqualified function ARN and that function's `:live` alias ARN. |
| `LAMBDA_EXECUTION_ROLE_ARN`, `LAMBDA_LOG_GROUP_ARN` | Existing execution-role ARN and `/aws/lambda/<function-name>` log-group ARN. |
| `CLOUDFRONT_DISTRIBUTION_ARN`, `CLOUDFRONT_OAC_ARN`, `CLOUDFRONT_ORIGIN_REQUEST_POLICY_ARN` | Three distinct deployed CloudFront resource ARNs, using their actual IDs. |
| `STATE_BUCKET_ARN`, `STATE_KMS_KEY_ARN` | Bootstrap `stateBucketArn` and `stateKeyArn` outputs. |
| `APP_STATE_PREFIX` | Confirmed `/app` backend S3 object-key/listing prefix (no `s3://`, bucket name, or trailing slash). The policy appends `.pulumi/<directory>/prototype-serverless/*` to this prefix for project object grants. |
| `APP_BACKEND_META_OBJECT_ARN` | Exact ARN of the backend metadata object (for example `arn:aws:s3:::<bucket>/app/meta.yaml`); use the actual key, not an assumed location. |
| `SECRETS_STACK_STATE_OBJECT_ARN` | Exact object ARN of the referenced secrets stack's checkpoint under `/app`, read-only; do not use a directory wildcard or the SSM KMS key ARN. |
| `PULUMI_SECRETS_PROVIDER_KEY_ARN` | Pulumi `awskms:///` secrets-provider key ARN from `Pulumi.prototype.yaml`, confirmed against the existing stack (and referenced secrets stack if distinct). |

The template separates the wildcard-only ECR token, log-group description, and caller-identity actions from resource-scoped ECR push, Lambda function/version/alias operations, refresh reads, state S3 access, and the two KMS key uses. It deliberately does **not** allow creating resources, modifying IAM/CloudFront, writing Lambda permissions, or reading SSM runtime parameters. A future infrastructure change that requires any of those permissions needs a separate review; do not widen this policy simply to bypass a failed deployment. This identity cannot bootstrap an empty stack.

### Configure and operate GitHub Actions

Set the following in the repository's GitHub Actions settings (no protected GitHub Environment is required):

- **Variable** `PROTOTYPE_PULUMI_BACKEND_URL`: the verified existing app backend, e.g. `s3://<state-bucket>/<confirmed-app-backend-prefix>`; do **not** use bootstrap's `/bootstrap` output as the app URL.
- **Secret** `PROTOTYPE_CD_AWS_ACCESS_KEY_ID`: dedicated IAM user's access key ID.
- **Secret** `PROTOTYPE_CD_AWS_SECRET_ACCESS_KEY`: that access key's secret.

The job uses the already-configured `ap-southeast-1` region and stack `prototype`, Node `22.23.2`, pnpm from the root package-manager pin, Pulumi CLI `3.267.0`, frozen dependencies, and a Docker-capable runner. It logs in to the given S3 backend and runs `pulumi up --yes` with `IMAGE_TAG` set to the triggering **commit SHA**. Never remove `IMAGE_TAG` in CD: untagged repository-only mode would propose removal of the Lambda and distribution. Keep the access key out of logs and repository files.

Existing CI still triggers on pushes to `develop`, subject to its existing workflow-level ignores. Deployment additionally waits for the successful `build` job (after lint, type-check, and format) and a changed-files job. The push must change a **non-Markdown** file under `apps/**`, `packages/**`, or `infra/**`, or one of `Dockerfile.lambda`, `.dockerignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows/ci.yml`. Mixed commits with a qualifying file deploy; Markdown-only changes, even under `infra/**`, and unrelated files such as `docker-compose.yaml` or `services/mock-auth/config.yaml` do not. An initial push without a valid previous commit fails closed. Deployments share a concurrency group and do not cancel an update in progress. A successful older run can deploy even if newer app-affecting changes have reached `develop`; newer pending GitHub runs can replace intermediate pending ones.

**Operator verification:** With the dedicated user, a Docker-capable environment, and the confirmed backend, run `pulumi login '<verified-app-backend-url>'` and `pulumi stack select prototype` from `infra/prototype-serverless`, then `IMAGE_TAG=<new-immutable-tag> pulumi preview` and a controlled `IMAGE_TAG=<same-tag> pulumi up`. Confirm backend S3 reads/writes, KMS state/secrets access, ECR image push, new Lambda version, and movement of `live`; inspect any denied API call before making a narrowly scoped policy revision. Check GitHub runs for qualifying, Markdown-only, unrelated, and mixed pushes and for CI failure/serialized updates. **No live AWS or GitHub deployment is claimed by this documentation.**

**Rollback:** Revert the bad app commit on `develop` and let the resulting **new SHA** rebuild the known-good source and update `live` after CI succeeds. If CI/CD is unavailable, an authorised operator can check out the known-good source and run a tagged preview/update against the existing backend with a **new immutable tag**. Do not reuse an existing ECR tag, run Pulumi without `IMAGE_TAG`, reinitialise state, or broaden the CD policy for emergency infrastructure changes. Revoke/rotate the dedicated access key if compromised.

### Overcoming Corporate Firewall

Follow these instructions when deploying the image for the first time from a local device behind a corporate firewall.

Copy your corporate CA certificate into the Docker BuildKit container's certs folder:

```bash
podman cp <path-to-ca-cert> <name-of-buildkit-container>:/etc/ssl/certs/
```

Reload the BuildKit daemon **INSIDE the container**:

```bash
pkill -HUP buildkitd
```

The above instructions will enable the BuildKit container to trust the self-signed certificate on the firewall.

However, as part of the build, the BuildKit container will fail to install the Prisma binaries in the step `turbo build --filter=backend --filter=frontend`. To resolve this, in `Dockerfile.lambda`, temporarily set the `LOCAL_BUILD` argument on the `awsx.ecr.Image` resource in `infra/prototype-serverless/index.ts`:

```ts
const image = new awsx.ecr.Image('prototype-serverless-built-image', {
    repositoryUrl: repository.repositoryUrl,
    registryId: accountId,
    imageTag,
    context: '../..',
    dockerfile: '../../Dockerfile.lambda',
    platform: 'linux/amd64',
    // ADD BLOCK BELOW TEMPORARILY
    args: {
      LOCAL_BUILD: 'true'
    }
  })
```

## Validation and known limits

- Build and locally smoke-test the Lambda container: check `/api/v1/health` (requires a reachable database), SPA deep links, built assets, missing assets (must not return HTML as 200), and API error paths. Ensure runtime configuration is available **before NestJS modules load**.
- Preview both bootstrap and image-backed phases against the intended backend/account/region. Automated CD does not provide an AWS preview environment or bootstrap new resources; an operator must run those checks with authorised credentials and a working Docker build environment for `up`.
- Once the **separate** runtime-secret-loading effort lands, test direct unauthenticated Function URL denial versus CloudFront success, Singapore access versus non-Singapore 403, API POST and cookie sessions, SPA routes, static and missing-asset behavior, cache/error semantics, startup logs, and a second image-tag deployment. An IAM-authenticated direct URL is not intended as a public origin; verify the deployed alias permissions remain distribution-scoped.
- The Lambda role has logging, SSM parameter-path read, and secrets-project KMS decrypt grants in `index.ts`; these **runtime** grants are not CD-user permissions. The separate application retrieval effort must still load and validate the required parameters. Existing secrets use `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, while the backend expects `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY`; resolve that mapping in the separate application work. Infrastructure deployment by itself does not make the app start successfully.
- Set application domain, OAuth callback URL, passkey RP ID, and passkey origin to match the generated CloudFront hostname before authentication tests. Verify secure session-cookie and mutation behavior behind the HTTPS proxy.
- The CloudFront `SG` allowlist filters by viewer IP geolocation; it is not proof of a person's location or Singapore-only processing. Lambda suitability (startup, cold starts, DB connections, auth and load behavior) remains unvalidated. Do not treat successful provisioning as production readiness.
