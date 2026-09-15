# Instructions for Creating Zod Schemas
Schemas are located in `packages/api-contract/src/schemas/`.

## Location Rules

- If the schema you intend to create naturally belongs to an existing schema file, create the schema in that file.
- Otherwise, create a new schema file, and add the barrel export to `packages/api-contract/src/schemas/index.ts`. The new schema is to be created in that new schema file.

## Creating Schemas

- Decide whether to extend or create a schema from scratch:
  - If it is similar to another existing schema in that file or any of the common schemas, create the new schema by **extending** that existing schema.
  - Otherwise, create the new schema from scratch.
- Design the schema around the required response structure. **DO NOT** call `z.array()` on individual schemas for collection endpoints. Instead, create a dedicated list schema, defining the schema first if needed (e.g. define `const EntitySchema = z.object(...)`, and then `const EntityListSchema = z.array(EntitySchema)`).
- Name the schema based on the contents of the schema, **NOT** the route that it is serving.
- The schema name must be in PascalCase, and have `Schema` as the suffix e.g. `PascalCaseSchema`.
- The schema must have an accompanying TypeScript type defined right after it in the file. The type is to be inferred using `z.infer<typeof SomeSchema>`, and named the same as the schema without the `Schema` suffix.

An example of a schema:

```ts
// Individual
export const UserPostSchema = z.object({ ... })
export type UserPost = z.infer<typeof UserPost>


// Collection
export const UserPostsListSchema = z.array(UserPostSchema)
export type UserPostsList = z.infer<typeof UserPostsListSchema>
```
