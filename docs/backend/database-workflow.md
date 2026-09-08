# Database Workflow
All commands below should be run in `apps/backend`.

## Quick Workflow

### 1. Make Changes to Schema
Amend the Prisma schema file in `apps/backend/prisma/schema.prisma`, abiding by the following guidelines:

- Column names are to be in camelCase
- Always use uuid(7) for primary keys
- For relations, include both the entity (e.g. `User`) and a foreign key column (e.g. `userId`)
- Always index foreign keys
- Always add the following datetime columns to each new entity:
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
  - `deletedAt DateTime?`

### 2. Synchronise Changes

1. Run `npm run db:reset` to reset the database.
2. Run `npm run db:sync` to push the schema and re-generate the Prisma client.

### 3. Seed Database
If there is a seed script `apps/backend/prisma/seed.ts`, run `npm run db:seed:run` to seed the database.

## Full Workflow

### 1. Make Changes to the Schema
Same as above.

### 2. Generate Migration
Run `npm run db:migration:gen --name=<migration-name>`, abiding by the following guidelines for `migration-name`:

- The name must be in snake-case
- The name must be short and descriptive of the migration (e.g. `add-user-name-column`, NOT `add-user-name-column-to-users-table`)

### 3. Synchronise Changes

1. Run `npm run db:migration:run` to run the migration.
2. Run `npm run db:generate` to re-generate the Prisma client.
