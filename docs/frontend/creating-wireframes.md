# Guidelines for Creating Wireframes

This document describes how to create a wireframe: a placeholder-only, interactive mockup of a page or component. Its purpose is to review and iterate on design and interactions before committing to a real implementation.

## Where Wireframes Live

Wireframes live under `apps/frontend/src/wireframes`. The conventions in [Creating Components](./creating-components.md) apply — component naming, folder structure, nesting — except that everything is placed under `apps/frontend/src/wireframes` instead of `apps/frontend/src/pages` or `apps/frontend/src/components`.

### Pages

Page folders mirror the frontend route structure under the `/wireframes` prefix, following the pages conventions:

- Name page components with a `Page` suffix (e.g. `UsersPage`).
- Name page folders after the route segment (e.g. `users`, `users/[id]`).

### Reusable components

Reuse existing components from `apps/frontend/src/components` where applicable.

If a wireframe needs its own reusable component that is not (yet) used in prod, place it under `apps/frontend/src/wireframes/components` following the usual component conventions. Do NOT add wireframe-only components to `apps/frontend/src/components`.

## Placeholders Only

A wireframe contains placeholders and UI interactions only:

- Use inline sample data inside the component to render the design.
- Do NOT add data-fetching logic:
  - No hooks from `apps/frontend/src/hooks`
  - No `useQuery` / `useMutation`
  - No `useData` hook in the component folder (the pattern in [Creating Components](./creating-components.md) does not apply to wireframes)
  - No calls through the oRPC client
- UI interactions (e.g. buttons, dialogs, form validation, navigation) should work as they would in prod, using the placeholder data.

## Adding the Route

Add a relative route under the `/wireframes` route in `apps/frontend/src/app/App.tsx`, inside the `import.meta.env.DEV` block, so wireframes never ship to prod. Wrap the route in the same layout components the prod page would use (e.g. `WithSidebarLayout`), where applicable.

## Finishing Up

After the user has reviewed and iterated on the design, commit the changes. See [Commit messages](../general/commit-messages.md).
