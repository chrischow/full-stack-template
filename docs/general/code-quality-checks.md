# Instructions for Running Code Quality Checks
Code quality checks **MUST** be run after each task that involves editing code.

This project has three code quality checks that should be run from the root of the repo:

1. `lint` with ESLint: `npm run lint`
2. `format` with Prettier: `npm run format`
3. `check-types` with TypeScript: `npm run check-types`

The code quality checks should be run using the `run-npm-script` tool.