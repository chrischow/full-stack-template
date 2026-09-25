# Guidelines for Adding Environment Variables

## 1. Add to schema
The `EnvSchema` in `apps/backend/src/env/schema.ts` contains a list of all environment variables that are parsed from the OS process (`process.env`). Add a new entry (name in all caps) for the environment variable with an appropriate Zod schema. Examples:

```ts
export const EnvSchema = z.object({
  ...,
  STRING_ENV_VAR: z.string().default(...),
  INT_ENV_VAR: z.string().transform(Number).default(...),
  ENUM_ENV_VAR: z.enum([...]),
  BOOL_ENV_VAR: z.string().transform(Boolean).default(true),
  ...
})
```

## 2. Add to `.env.development`
Add an entry in `.env.development` with the same name (all caps) and a suitable value for development purposes.
