# Instructions for Running the Development Environment
All commands below should be run from the root of the repo.

## Start Services
Run `pnpm dev:infra:start` to start (1) a Postgres DB, (2) Dex IdP, (3) a mail server, and (4) mock Simple Email Service.

## Stop Services
Run `pnpm dev:infra:stop` to stop the services.

## Tear Down Environment
Run `docker-compose down -v --remove-orphans` to tear down the development environment.