# Instructions for Running Code Quality Checks
Code quality checks **MUST** be run after each task that involves editing code.

This project has three code quality checks that should be run from the root of the repo:

1. `lint` with ESLint: `pnpm lint:fix`
2. `format` with Prettier: `pnpm format:fix`
3. `check-types` with TypeScript: `pnpm check-types`

The code quality checks should be run using the `run-npm-script` tool.