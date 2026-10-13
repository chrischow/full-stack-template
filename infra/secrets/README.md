# Secrets Pulumi project

This project provisions 30 application environment settings as AWS Systems Manager Parameter Store parameters. The `prototype` stack uses `/prototype/<ENV_NAME>` paths in the configured AWS region. Five parameters are SSM `SecureString`; the other 25 are SSM `String`. **All 30 inputs must be entered as encrypted Pulumi secret config**, including those destined for SSM `String`.

The Pulumi secrets provider is an **existing external AWS KMS key** that encrypts stack config. The separate SSM KMS key created by this project encrypts only the five `SecureString` parameters; it cannot serve as the Pulumi secrets provider because it does not exist when the stack is initialized. The program does not read `.env.development` during preview or update. Never commit plaintext values or log, echo, or print them in verification output. SSM `String` values are readable in plaintext by identities granted SSM read access, regardless of encrypted Pulumi config.

## User setup (run from `infra/secrets`)

These are **operator-run instructions**; do not run them as part of implementing the project. Use an authorized deployment identity with access to the S3 state bucket's `/secrets` prefix and the external Pulumi KMS secrets-provider key. For `prototype`, `infra/secrets/Pulumi.prototype.yaml` specifies `aws:region: ap-southeast-1` and `secrets:accountId: "699037282084"`. Confirm that these are the intended target before doing anything with resources. The application parameter `secrets:AWS_REGION` is independent of the provider setting `aws:region`; it does not select where Pulumi deploys.

1. Choose your authorized AWS profile and independently confirm the active account and region. The account guard compares `secrets:accountId` to the caller identity **before** creating resources. Confirm the profile's permissions and region (`aws:region`) as well as the selected stack; stack names are not allowlisted and determine the parameter prefix.

   ```bash
   export AWS_PROFILE='<authorized-deployer-profile>'
   aws sts get-caller-identity
   aws configure get region --profile "$AWS_PROFILE"
   ```

   The Pulumi AWS provider uses `aws:region` from the stack config even when the profile's default region differs. Make sure the selected region is the one intended for this stack. Keep the bucket name and external KMS key ARN available from your trusted bootstrap records; do not substitute the SSM key managed by this project.

2. Log in to the **environment state bucket's `/secrets` prefix**. Use an existing stack if one is already there; do not overwrite or reinitialize it. For a new `prototype` stack, initialize it with the pre-existing external KMS-backed Pulumi secrets provider. Replace only the nonsecret placeholders below.

   ```bash
   pulumi login 's3://<environment-state-bucket>/secrets'
   pulumi stack init prototype --secrets-provider 'awskms:///<external-pulumi-kms-key-arn>'
   pulumi stack select prototype
   pulumi stack ls
   ```

   If the stack already exists in that backend, **select** it instead of running `stack init`; confirm its secrets provider uses the external KMS key before adding any values. The decrypting identity must be authorized by that key's policy and IAM. Do not initialize with a passphrase or the new project-managed SSM key. Never use `--show-secrets` to inspect stack config.

3. Enter each of the 30 values **interactively**. From `infra/secrets`, run each command below individually and supply the corresponding value from your trusted source only when the Pulumi CLI prompts. The `secrets` project automatically qualifies an unprefixed CLI key (for example, `DB_PASSWORD`) as `secrets:DB_PASSWORD` in stack config; the program reads that namespace. Do not place a value on the command line, use a shell loop that prints it, or copy plaintext into stack YAML. In particular, `pulumi config set <key> <value> --secret` is unsafe: values may leak through shell history or process listings. All entries must appear as encrypted `secure:` entries under their `secrets:` namespace in the stack config. If your CLI does not support an interactive prompt when the value is omitted, stop and choose a secure input method rather than adding a value argument.

   ```bash
   pulumi config set NODE_ENV --secret
   pulumi config set APP_PORT --secret
   pulumi config set APP_DOMAIN --secret
   pulumi config set APP_NAME --secret
   pulumi config set DB_HOST --secret
   pulumi config set DB_PORT --secret
   pulumi config set DB_NAME --secret
   pulumi config set DB_USERNAME --secret
   pulumi config set DB_PASSWORD --secret
   pulumi config set KV_TTL_SECONDS --secret
   pulumi config set SESSION_NAME --secret
   pulumi config set SESSION_SECRET --secret
   pulumi config set SESSION_COOKIE_MAX_AGE --secret
   pulumi config set OAUTH_BASE_URL --secret
   pulumi config set OAUTH_CLIENT_ID --secret
   pulumi config set OAUTH_CLIENT_SECRET --secret
   pulumi config set OAUTH_CLIENT_CALLBACK_URL --secret
   pulumi config set OTP_REQUEST_TIMEOUT_SECONDS --secret
   pulumi config set OTP_VALIDITY_SECONDS --secret
   pulumi config set OTP_MAX_RETRIES --secret
   pulumi config set OTP_SECRET --secret
   pulumi config set AWS_REGION --secret
   pulumi config set AWS_ACCESS_KEY_ID --secret
   pulumi config set AWS_SECRET_ACCESS_KEY --secret
   pulumi config set AWS_SES_ENDPOINT --secret
   pulumi config set PASSKEY_RP_ID --secret
   pulumi config set PASSKEY_ORIGIN --secret
   pulumi config set PASSKEY_REGISTER_TIMEOUT_SECONDS --secret
   pulumi config set PASSKEY_AUTHN_TIMEOUT_SECONDS --secret
   pulumi config set PASSKEY_VERIFICATION_DAYS --secret
   ```

4. Review only key names and encryption markers (never reveal values); confirm the backend, active stack, account and region again. The committed prototype YAML includes **only nonsecret config**; encrypted ciphertext in your populated stack YAML is expected. Review Git changes carefully before committing any stack config, and do not commit plaintext, temporary exports or terminal output that might contain values. If you need to share a preview, verify it contains no plaintext first.

   ```bash
   pulumi stack ls
   pulumi config
   pulumi preview
   ```

   Review the proposed paths, types, `keyId` references and key policy before proceeding. When authorized, apply with `pulumi up`; only the operator performs preview/update. A missing config key or account mismatch should stop the program. Repeat a preview afterward to look for unintended drift. Do not use `--show-secrets` or retrieve parameter values as part of verification.

## Permissions and key lifecycle

- **Secrets deployer:** Needs state-backend access scoped to the `/secrets` prefix, decrypt/encrypt access to the **external Pulumi secrets-provider key**, and the ability to create/update/refresh SSM parameters and create/manage/use the project SSM key. Provision only the actions and parameter paths needed for the target stack; SSM `SecureString` writes require the necessary KMS permissions. The bootstrap state-backend policy alone is not sufficient for these permissions. Restrict who may run updates and access encrypted stack state.
- **Runtime identity:** Grant only the SSM read actions required for the specific `/<stack>/<ENV_NAME>` parameter ARNs that service consumes. For `SecureString` reads with decryption, also grant `kms:Decrypt` on **this stack's SSM key**, constrained where feasible by `kms:ViaService` (regional SSM service) and `kms:EncryptionContext:PARAMETER_ARN` (the required parameter ARNs). Do not grant the runtime role access to the Pulumi-provider key, Pulumi stack config or S3 state. SSM `String` reads need no SSM-key decrypt permission; they still disclose the value to any allowed reader.
- **Key policy and recovery:** The project SSM key policy delegates administration through the account root principal and IAM. Explicit denies restrict cryptographic use to the regional SSM service and this stack's SSM parameter encryption context, even when an IAM principal has broader KMS cryptographic grants. The account's authorized key administrators must retain a recovery path to review/change this key policy; deployer and runtime permissions must be granted separately in IAM. Confirm the SSM encryption-context ARN and regional service condition in your account before use. Review key grants and access as part of deployment. Keep routine infrastructure CI unable to decrypt the external Pulumi config or use the SSM key.
- **Lifecycle:** The SSM key has rotation enabled, a 30-day deletion window, and Pulumi `protect` plus `retainOnDelete`. Do not disable/delete it or remove the administrator recovery path without planning migration and recovery of all five `SecureString` values: disabling/deleting the key prevents their decryption. Deleting or renaming parameters is also a deliberate, potentially disruptive change. External Pulumi-provider key rotation/recovery is a **separate** operational responsibility.

## User verification checklist

Perform these checks yourself with the intended AWS account, region, backend and `prototype` stack. Do not include parameter values in shared logs, screenshots or reports. The implementation process does **not** run Pulumi or AWS verification.

- [ ] Confirm the active backend is the environment state bucket's `/secrets` prefix; `pulumi stack ls` and `pulumi config` show `prototype`, `aws:region`, `secrets:accountId`, and exactly the 30 `secrets:<ENV_NAME>` inputs listed in the interactive commands above. Confirm every one is encrypted (`secure:` in the stack YAML) and no plaintext values are checked in or printed. Never use `--show-secrets`.
- [ ] After entering all inputs, review `pulumi preview` without displaying secret values. Verify exactly **one** new dedicated SSM KMS key, no unexpected resources, and exactly **30** SSM parameters. Compare the 30 original names listed in the commands above one-to-one against the paths `/${stack}/${ENV_NAME}`: for `prototype` each is `/prototype/<ENV_NAME>`, with identical spelling and no missing, additional, or duplicate paths. `secrets:accountId` is nonsecret guard config, **not** an SSM parameter.
- [ ] Verify that `/prototype/DB_PASSWORD`, `/prototype/SESSION_SECRET`, `/prototype/OAUTH_CLIENT_SECRET`, `/prototype/OTP_SECRET`, and `/prototype/AWS_SECRET_ACCESS_KEY` are the **only five** `SecureString` parameters. Each must reference the new stack SSM key ARN in `keyId`. The other **25** parameters must be `String` and must have no `keyId`. Review without revealing values.
- [ ] Confirm the key is symmetric, has rotation enabled, a 30-day deletion window, a recoverable administrative policy, and Pulumi protection. Check that its cryptographic-use conditions scope use to the regional SSM service and this stack's SSM parameter ARN encryption context. Confirm the intended deployer can write/refresh, the runtime role can read/decrypt only what it needs, and ordinary infrastructure CI cannot decrypt the external Pulumi config or use this SSM key.
- [ ] In a safe, controlled verification setting, confirm an incorrect `secrets:accountId` for the selected credentials causes an error **before** resource registration; restore the correct ID immediately. Confirm that a missing required `secrets:<ENV_NAME>` key causes a preview error; restore it securely afterward. Do not run these tests by changing production state or exposing a value. A wrong/missing stack is **not** rejected by an allowlist: verify the selected stack and backend yourself before each preview or update.
- [ ] If you choose to deploy, verify names, types, key associations, rotation and policy in the intended AWS account without requesting or printing any parameter value. Run another value-safe preview and confirm there are no unintended changes. Keep the SSM key enabled and available for the five encrypted parameters.

## Future stacks

For `staging` or `production`, create a separate stack in the same `/secrets` backend with its own nonsecret `aws:region` and `secrets:accountId` config, an **external** Pulumi KMS secrets provider, independent encrypted config for all 30 names, and appropriate account/region permissions. Confirm the intended stack before preview or update. Pulumi names parameters under `/<stack>/` and provisions a separate project-managed SSM key for that stack; it does not translate `production` to `prod` or infer the provider region from `secrets:AWS_REGION`. Never copy encrypted config between stacks unless the security and provider-key implications are explicitly reviewed.
