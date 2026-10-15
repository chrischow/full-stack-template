# Prototype Serverless Infra

This Pulumi project provisions an ECR repository, then builds and pushes a Lambda image with `awsx.ecr.Image` and provisions Lambda and CloudFront. It is for **prototype** infra only.

## Prerequisites

- The `bootstrap` prototype stack must be initialised
- The `secrets` prototype stack must be initialised with the required secrets
- AWS credentials to manage ECR, Lambda, and CloudFront

## Initialisation

Login to the remote backend:

```bash
export AWS_PROFILE='<authorized-prototype-profile>'
pulumi login 's3://<verified-state-bucket>/app'
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
```

### Deploy New Image

> **Note:** After running this successfully the first time, DO NOT run `pulumi up` without an image tag because this will remove the Lambda and CloudFront distribution.

Choose an immutable tag (e.g. commit SHA) for each image release and export it as `IMAGE_TAG` for both preview and update. Pulumi will build the image and push it to ECR.

For the first run, this will create a Cloudfront distribution, log group, IAM role, and a Lambda function that is pointed at the newly-created image. For subsequent runs, deployments will build the image, point the Lambda function at the new image, and update the `live` alias.

```bash
export IMAGE_TAG=<new-immutable-tag>
pulumi preview
pulumi up
```

#### Overcoming Corporate Firewall

If your local device is behind a corporate firewall, you will need some additional configuration **before** deploying.

After your first deployment failure, you should see a BuildKit container running in Podman/Docker. Copy your corporate CA certificate into the BuildKit container's certs folder:

```bash
podman cp <path-to-ca-cert> <name-of-buildkit-container>:/etc/ssl/certs/
```

Reload the BuildKit daemon **INSIDE the container**:

```bash
pkill -HUP buildkitd
```

The above instructions will enable the BuildKit container to trust the self-signed certificate on the firewall. The deployment should succeed now.

## Continuous Deployment on `develop`

The `deploy` job in `.github/workflows/ci.yml` is for **updates to an already-initialised `prototype` stack**. The trigger conditions are:

- Merge to `develop`; AND
- App-related or infra-related code/artifact changes

### Setup: GitHub Variables and Secrets

Set up the following variables/secrets on GitHub:

| Type | Name | Purpose |
| :- | :- | :- |
| Variable | `PROTOTYPE_PULUMI_BACKEND_URL` | S3 backend URL: `s3://<bucket-name>/app` |
| Secret | `PROTOTYPE_CD_AWS_ACCESS_KEY_ID` | Access key ID for CD IAM user |
| Secret | `PROTOTYPE_CD_AWS_SECRET_ACCESS_KEY` | Secret access key for CD IAM user |

### Setup: CD IAM User

After initialisation of the stack, run the following to get the outputs:

```bash
pulumi stack output
```

Use the following outputs to replace the placeholders in `cd-user-policy.json`:

| Name | Purpose |
| :- | :- |
| `repositoryArn` | For permissions to read and push to existing ECR repo. |
| `lambdaFunctionArn` | For permissions to read and update the Lambda function. |
| `lambdaAliasArn` | For permissions to get and update the Lambda alias, `live`. |
| `lambdaExecutionRoleArn` | For permissions to read the role for comparing state. No updates allowed. |
| `lambdaLogGroupArn` | For permissions to read tags on the log group for comparing state. No updates allowed. |
| `cloudfrontDistributionArn` | For permissions to read the CloudFront distribution for comparing state. No updates allowed. |
| `cloudfrontOacArn` | For permissions to read the CloudFront Origin Access Control for comparing state. No updates allowed. |
| `cloudfrontOriginRequestPolicyArn` | For permissions to read the CloudFront Origin Request Policy for comparing state. No updates allowed. |

Also use the following variables from the other Pulumi projects to replace the remaining placeholders:

| Name | Purpose |
| :- | :- |
| `STATE_BUCKET_ARN` | For amending state for this stack, and reading state from the secrets project. No update to the secrets project state are allowed. |
| `STATE_KMS_KEY_ARN` | For encrypting and decrypyting state. |
| `PULUMI_SECRETS_PROVIDER_KEY_ARN` | For encrypting and decrypting Pulumi secrets. |

Commit the changes.

On the AWS Console, created an IAM user with an inline policy defined in the updated `cd-user-policy.json`

## Rollback
Revert the bad app commit on `develop` to create a **new SHA**. Either:

- Re-run the deployment locally with the new SHA; or
- Commit it to `develop`

Do not use an existing image tag or an empty image tag.
