# Guidelines for Consuming an API Endpoint

## Retrieving Data

Decide whether to use `useQuery` or `useMutation`:

- If the objective is to read and cache the data, use `useQuery`.
- Otherwise, if the objective is to retrieve the data imperatively, use `useMutation`.

Create a new custom hook:

- Create the new custom hook in `frontend/src/hooks/index.ts`, and add the barrel export to  `frontend/src/hooks/index.ts`.
- Use the appropriate options from the ORPC client.
  - For `useQuery`: Use `orpc.<resource>.<parent_key>.<route_key>.queryOptions()`. Configure additional TanStack-Query query options (e.g. `input`) as required.
  - For `useMutation`: Use `orpc.<resource>.<parent_key>.<route_key>.mutationOptions()`. Configure additional TanStack-Query mutation options (e.g. `onSuccess`, `onError`) as required.
- At minimum, `data` and `isLoading` should be returned from the custom hook.
- Each custom hook should only handle data retrieved from a single endpoint. However, in cases where data from more than one query needs to be returned in the same custom hook, `data` and `isLoading` from different queries should be named according to the type of data returned.
- For arrays, return an empty array if the data has not loaded yet. DO NOT return `undefined`.

An example of a custom hook for retrieving data is:

```ts
export const usePosts = () => {
  const { data: posts, isLoading: isPostsLoading } = useQuery(orpc.posts.list.queryOptions())
  const { data: otherData, isLoading: isOtherDataLoading } = useQuery(orpc.posts.listOther.queryOptions())

  return {
    posts: posts ?? [],
    isPostsLoading,
    otherData: otherData ?? [],
    isOtherDataLoading,
  }
}
```

## Creating/Updating/Deleting Data

Create a new custom hook:

- Create the new custom hook in `frontend/src/hooks/index.ts`, and add the barrel export to  `frontend/src/hooks/index.ts`.
- Use `useMutation` with `orpc.<resource>.<parent_key>.<route_key>.mutationOptions()`. Configure additional TanStack-Query mutation options (e.g. `onSuccess`, `onError`) as required.
- At minimum, `mutate`, `mutateAsync`, and `isPending` should be returned from the custom hook. Return `mutateAsync` if the component consuming this mutation function needs to await the result.
- In cases where data from more than one mutation needs to be returned in the same custom hook, `mutate` and `isPending` from different mutations should be named according to the type of action being performed.

An example of a custom hook for creating/updating/deleting data is:

```ts
export const usePostMutations = () => {
  const { mutate: createPost, mutateAsync: createPostAsync, isPending: isCreating } = useMutation(
    orpc.posts.create.mutationOptions({ onSuccess: ..., onError: ... })
  )
  const { mutate: updatePost, mutateAsync: updatePostAsync, isPending: isUpdating } = useMutation(
    orpc.posts.update.mutationOptions({ onSuccess: ..., onError: ... })
  )
  const { mutate: deletePost, mutateAsync: deletePostAsync, isPending: isDeleting } = useMutation(
    orpc.posts.delete.mutationOptions({ onSuccess: ..., onError: ... })
  )

  return {
    createPost,
    createPostAsync,
    isCreating,
    updatePost,
    updatePostAsync,
    isUpdating,
    deletePost,
    deletePostAsync,
    isDeleting,
  }
}
```