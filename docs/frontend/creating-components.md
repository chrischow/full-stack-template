# Guidelines for Creating Components

## Common Guidelines

- Component naming: All components should be named in PascalCase. The name should be succinct and representative of what the component contains.
- Folder naming:
  - By default, all components should be defined in an `index.tsx` file placed in a folder named after the component.
  - The component name and the folder name must be the same.
- Nesting: Sub-components should be nested in the parent component's folder and follow the same rules above.
- Each `index.tsx` component file should export only the component via a default export, and **nothing else**. This avoids breaking Vite's Fast Refresh.
- Other reusable code that needs to be exported should be placed in separate files. If they are used only in that component, then place them inside the component folder. Otherwise, place them at the lowest level possible in the overall `apps/frontend/src` directory. A non-exhaustive list of examples of reusable code:
  - `types.ts`: For types used only on the frontend (e.g. props interface)
  - `utils.ts`: For utility functions
  - `constants.ts`: For constants
- For component `index.tsx` scaffolds, use the following template:
  ```tsx
  const ComponentName = () => {
    return (
      <div>ComponentName</div>
    )
  }

  export default ComponentName
  ```
- Retrieving data:
  - Use the hooks in `apps/frontend/src/hooks` to retrieve data where possible. These are hooks that call existing endpoints. There is a 1-to-1 mapping between endpoints on the backend and hooks in this folder that call `useQuery`.
  - If none of those hooks are fit for the component's purposes, create a `useData` hook in the component folder to perform component-specific data processing on data retrieved from a generic hook. The hook should return data that the component requires, TanStack Query's `isLoading` boolean, and any other artifacts as required. For example:
    ```ts
    export const useData = () => {
      const { data: rawData, isLoading } = useSomeHook()

      const processedData = rawData.map(...)

      return {
        processedData,
        isLoading,
      }
    }
    ```

## Organisation
There are two directories where components should reside:

1. The pages directory `apps/frontend/src/pages`: For components that are pages, and components that are used only once. Place a component here if (a) it is a page or (b) there is currently only one use for it.
2. The components directory `apps/frontend/src/components`: For components that are used more than once. Only move components here if there is an immediate need to use it in more than one place. For example, if a `SubmitButton` component exists under Page A, and a new Page B is being created and needs it too, move the `SubmitButton` component to `apps/frontend/src/components/SubmitButton`, and import it in both Page A and Page B.

### Pages Directory: `apps/frontend/src/pages`
The pages directory follows the frontend route structure. It contains components that are pages and components that are used only once.

Components that are pages ("page components") and their containing folders ("page folders") should follow these conventions, which take precedence over the identically-named conventions under the Common Guidelines:

- Component naming: Page components should be named with a `Page` suffix (e.g. `UsersPage`).
- Folder naming:
  - If the page component is for a static route segment, name the folder after the route segment e.g. `users`
  - Otherwise, if the page component is for a dynamic route segment, name the folder using the route parameter in square brackets e.g. if the route param is `:id`, the folder should be named `[id]`
- Nesting convention:
  - Page folders must follow the frontend route structure.
  - For example, if there is a `<domain>/users/:id/posts` frontend route, then there should be a `users` folder containing an `[id]` folder, containing a `posts` folder.


### Components Directory: `apps/frontend/src/components`
The components directory contains components that are **strictly** used more than once.

### Example
Suppose that we have a frontend app with the following routes:

- `/users`: A page containing a list of all users in card form, that happens to use a component, `SomeReusableComponent`
  - `/users/[id]`: A page showing a specific user's details
    - `/users/[id]/activities`: A page listing a specific user's activities
- `/posts`: A page containing a list of all posts, that happens to use a component, `SomeReusableComponent`

```
apps/frontend/src/
├── pages/
│   ├── users/
│   │   ├── index.tsx  # Renders SomeReusableComponent
│   │   ├── UserCard  # Not used anywhere else in the app
│   │   │   └── index.tsx
│   │   └── [id]/
│   │       ├── index.tsx
│   │       └── activities/
│   │           └── index.tsx
│   ├── posts/
│   │   └── index.tsx  # Renders SomeReusableComponent
│   └── (other routes)
└── components/
    ├── SomeReusableComponent
    │   ├── index.tsx
    │   └── ChildOfReusableComponent
    │       └── index.tsx
    └── (other reusable components)
```