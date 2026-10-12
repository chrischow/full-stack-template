# Bootstrap

The bootstrap project provisions the self-managed Pulumi S3 state bucket, per-account KMS customer managed key (CMK), and minimal supporting resources (bucket versioning, server-side encryption, ownership controls, public access block, TLS-only bucket policy, lifecycle rules, and least-privilege IAM policy).

It must be initialized before other Pulumi projects (`prototype`, `production`) can run, as all projects log into the S3 backend created by `bootstrap`.

## Stacks

- `prototype`: State backend for the prototype environment
- `staging`: State backend for the staging environment (future)
- `production`: State backend for the production environment (future)

## Credentials

### Sandbox

The bootstrap can be completed using either (a) your admin user account or (b) a dedicated IAM user.

- If using your admin user account: Login via the CLI as per normal
- If using a dedicated IAM user:
  - Create a new IAM user (e.g. `prototype-bootstrap-user`) with the inline policy in `bootstrap-user-policy.json`.
  - Create an access key for that user. Save the secret access key.
  - Set up the profile locally:
      ```bash
      aws configure --profile sandbox-bootstrap
      ```
  - Fill in the access key ID and the secret access key.

### Staging / Prod

Use SSO to login. Be sure to set the correct profile.

## Bootstrap Instructions

### Preparation

- Run all commands from `infra/bootstrap`
- Use the appropriate AWS profile: `export AWS_PROFILE=<admin-user-or-bootstrap-iam-user>`
- Update the stack YAML file with the appropriate account ID


### Set up local backend

Login to a local backend:

```bash
pulumi login file://.
```

Initialise the `prototype` stack:

```bash
pulumi stack init prototype
```

Input a passphrase when prompted for one. This will be used temporarily for the local backend. After we move to the S3 backend, we will change the secrets provider so that no passphrase will be required.

Provision the resources:

```bash
pulumi up
```

Capture the `stateBucketName` for usage later:

```bash
pulumi stack output stateBucketName
```

Export the local state:

```bash
pulumi stack export --file prototype.state.json
```

In the AWS console, attach the created IAM policy `${appName}-pulumi-state-backend-${envSlug}` to the IAM user used for the bootstrap.

### Set up S3 backend

Login to the remote backend:

```bash
pulumi login "s3://<stateBucketName>/bootstrap"
```

Re-initialise the `prototype` stack with AWS KMS as the secrets provider:

```bash
pulumi stack init prototype --secrets-provider "awskms:///<cmk-arn>"
```

Import the previously export state file:

```bash
pulumi stack import --file prototype.state.json
```

Switch the stack's secrets provider to the AWS KMS key:

```bash
pulumi stack change-secrets-provider "awskms:///<cmk-arn>"
```

At this point, you should no longer be prompted for the passphrase.

### Verify migrated backend

```bash
pulumi stack ls
AWS_PROFILE=sandbox-bootstrap pulumi preview   # expect "no changes" and no passphrase prompt
```

### Cleanup

Delete the following:

- Exported state file `prototype.state.json`. This has already been imported to S3.
- The `.pulumi` folder

### For app infra
The app's infra can login to the backend as such:

```bash
pulumi login s3://<stateBucketName>/prototype
```

Note the folder name is `/prototype`. This is deliberately separate from the bootstrap project's stack.