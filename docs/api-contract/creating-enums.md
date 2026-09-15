# Instructions for Creating Enums

Enums must be created as schemas located in `packages/api-contract/src/schemas/`. 

# Location Rules

- If the enum you intend to create naturally belongs to an existing schema file, create the schema in that file.
- Otherwise, create a new schema file, and add the barrel export to `packages/api-contract/src/schemas/index.ts`. The new enum, schema, and type is to be created in that new schema file.

# Creating Enums
Enums must be created as an `as const` objects, with an accompanying schema and type. The `as const` object and type should have the same name.

An example of an enum:

```ts
export const Role = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
} as const

export const RoleSchema = z.enum(Role)
export type Role = z.infer<typeof RoleSchema>
```
