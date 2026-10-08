# Bootstrap

The bootstrap project provisions the self-managed Pulumi S3 state bucket, per-account KMS customer managed key (CMK), and minimal supporting resources (bucket versioning, server-side encryption, ownership controls, public access block, TLS-only bucket policy, lifecycle rules, and least-privilege IAM policy).

It must be initialized before other Pulumi projects (`prototype`, `production`) can run, as all projects log into the S3 backend created by `bootstrap`.

## Stacks

- `prototype`: State backend for the prototype environment
- `staging`: State backend for the staging environment (future)
- `production`: State backend for the production environment (future)

## Runbook: one-time prototype bootstrap and state migration

Run from `infra/bootstrap`. AWS profile is `starter-kit-prototype`; `AWS_PROFILE` is
never committed. Dummy account ID is `123456789012` (replace with real account ID from
`aws sts get-caller-identity` when deploying to actual AWS).

1. **Point the program at the prototype stack.** `Pulumi.prototype.yaml` already contains
   `config: { bootstrap:accountId: "123456789012", bootstrap:appName: fst, aws:region: ap-southeast-1 }`.
2. **First apply on the local backend** (creates the bucket; uses the passphrase secrets provider
   because the CMK does not exist yet):
   ```bash
   cd infra/bootstrap
   pulumi login file://.
   pulumi stack init prototype
   AWS_PROFILE=starter-kit-prototype pulumi up
   ```
   Capture the `stateBucketName` output (`pulumi stack output stateBucketName`).

   > **`file://.` vs `--local`.** Both select the local backend. `pulumi login --local` is shorthand for
   > `pulumi login file://~` and stores state under `~/.pulumi` (outside the repo).
   > `pulumi login file://.` stores it under `./.pulumi` in the project, which
   > `infra/bootstrap/.gitignore` already ignores. Either works; we use `file://.` to keep the throwaway
   > pre-migration state contained in the project directory.
3. **Export the local state:**
   ```bash
   pulumi stack export --file prototype.state.json
   ```
4. **Re-init the stack against the S3 backend and import:**
   ```bash
   pulumi login "s3://<bucket>/bootstrap"
   pulumi stack init prototype --secrets-provider "awskms://<cmk-arn>"
   pulumi stack import --file prototype.state.json
   ```
   `<bucket>` = the `stateBucketName` output (`<appName>-pulumi-state-<envSlug>-<accountId>`); `<cmk-arn>` =
   the `stateKeyArn` output. From here on the CMK is the stack's secrets provider.
5. **Delete the local state file** (`prototype.state.json`) — it is gitignored, but discard it explicitly.
6. **Verify the migrated backend:**
   ```bash
   pulumi stack ls
   AWS_PROFILE=starter-kit-prototype pulumi preview   # expect "no changes"
   ```
7. **Record the backend URL and account ID** for later projects: workload projects will log in with
   `pulumi login s3://<bucket>/prototype`.
