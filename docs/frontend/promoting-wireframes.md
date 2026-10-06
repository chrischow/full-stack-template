# Guidelines for Promoting Wireframes

This document describes how to promote an approved wireframe to prod code.

## Production Check
Check that the wireframe (page and its components) has been implemented in accordances with the guidelines in the `shadcn` skill. If the wireframe is not in compliance, refactor the non-compliant page and its components first.

## Move the Wireframe into Prod

Move the approved pages and/or components from `apps/frontend/src/wireframes` into the prod source tree, following the organisation rules in [Creating Components](./creating-components.md):

- Pages, and components used only once, move to `apps/frontend/src/pages`, following the pages conventions.
- Components used in more than one place move to `apps/frontend/src/components`.
- Do not move wireframe-only components that are not used by the promoted pages.
- Fix imports in the moved files, since relative paths change.

Once a page is promoted, remove it from the wireframes tree.

## Wire Up Real Data

Replace the placeholder data with real data fetching, following [Creating Components](./creating-components.md) and [Consuming an API Endpoint](./consuming-an-api-endpoint.md):

- Use the hooks in `apps/frontend/src/hooks` where possible.
- Otherwise, create a `useData` hook in the component folder to perform component-specific data processing.

## Add the Prod Route

1. Add a route under the prod route structure in `apps/frontend/src/app/App.tsx`
2. Amend the corresponding route from the `/wireframes` DEV block to use the promoted page.

## Test

The user tests the frontend end-to-end. Fix any issues found.

## Finishing Up

Commit the changes. See [Commit messages](../general/commit-messages.md).