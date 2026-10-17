# Secrets Pulumi Project

This project provisions application environment settings as AWS Systems Manager (SSM) Parameter Store parameters prefixed with the app name e.g. `/<appName>/<ENV_VAR_NAME>`. It uses the same AWS KMS customer-managed key as the `bootstrap` project for both (a) Pulumi secrets provider and (b) encrypting `SecureString` parameters.

Separately, it uses the same two AWS KMS customer-managed keys as the `bootstrap` project for (a) the Pulumi secrets provider and (b) encrypting state.

## Stacks

- `prototype`: SSM parameters for the prototype environment
- `staging`: SSM parameters for the staging environment (future)
- `production`: SSM parameters for the production environment (future)

## Credentials

### Sandbox

Secrets can be created by using either (a) your admin user account or (b) a dedicated IAM user. However, we strongly recommend using your own admin user account.

- If using your admin user account: Login via the CLI as per normal
- If you intend to use a dedicated IAM user:
  - Fill in the placeholders in `secrets-user-policy.json`.
  - Create a new IAM user (e.g. `prototype-secrets-user`) with the inline policy in `secrets-user-policy.json`.
  - Create an access key for that user. Save the secret access key.
  - Set up the profile locally:
      ```bash
      aws configure --profile <sandbox-secrets-profile>
      ```

## Secrets Management Instructions

### Preparation

- Run all commands from `infra/secrets`
- Use the appropriate AWS profile: `export AWS_PROFILE=<admin-user-or-bootstrap-iam-user>`
- Update the stack YAML file with the appropriate account ID

### Setup

Run these steps if the stack has not been initialised yet. Login to the `/app` backend:

```bash
pulumi login "s3://<bucket-name>/app"
```

Initialise the stack:

```bash
pulumi stack init <prototype|staging|production> --secrets-provider "awskms:///<key-arn>"
```

### Manage Secrets

Select the stack:

```bash
pulumi stack select prototype
```

All parameters in AWS are created from configs in Pulumi:

- For plaintext: `pulumi config set <key> <value> --plaintext`
- For secrets: `pulumi config set <key> <value> --secret`

To remove configs: `pulumi config rm <key>`.

These should be done **interactively** via the CLI. Run the commands below. Each one will prompt for the value.

```bash
pulumi config set DB_PASSWORD --secret
pulumi config set SESSION_SECRET --secret
pulumi config set OAUTH_CLIENT_SECRET --secret
pulumi config set OTP_SECRET --secret
pulumi config set SES_SECRET_ACCESS_KEY --secret
```
