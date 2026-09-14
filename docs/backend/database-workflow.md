# Database Workflow

## Quick Workflow

### 1. Make Changes to Schema
Amend the Prisma schema file in `packages/db/prisma/schema.prisma`, abiding by the following guidelines:

- Column names are to be in camelCase
- Always use uuid(7) for primary keys
- For relations, include both the entity (e.g. `User`) and a foreign key column (e.g. `userId`)
- Always index foreign keys
- Always add the following datetime columns to each new entity:
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
  - `deletedAt DateTime?`

### 2. Synchronise Changes

Run `npm run db:sync -w packages/db` to push the schema and re-generate the Prisma client.

If that fails, you will have to run `npm run db:reset -w packages/db` to reset the database first, then try to run `npm run db:sync -w packages/db` again.

### 3. Seed Database
If there is a seed script `packages/db/prisma/seed.ts`, run `npm run db:seed:run` to seed the database.

## Full Workflow

### 1. Make Changes to the Schema
Same as above.

### 2. Generate Migration
Run `npm run db:migration:gen --name=<migration-name> -w packages/db`, abiding by the following guidelines for `migration-name`:

- The name must be in snake-case
- The name must be short and descriptive of the migration (e.g. `add-user-name-column`, NOT `add-user-name-column-to-users-table`)

### 3. Synchronise Changes

1. Run `npm run db:migration:run -w packages/db` to run the migration.
2. Run `npm run db:generate -w packages/db` to re-generate the Prisma client.
