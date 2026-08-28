import z from 'zod'

export const UserSchema = z.object({
  id: z.uuidv7(),
  name: z.string(),
  email: z.email(),
  lastVerifiedAt: z.coerce.date().nullable(),
  lastRequestedAt: z.coerce.date().nullable(),
})
export type User = z.infer<typeof UserSchema>

export const UpdateUserInputsSchema = UserSchema.omit({ id: true }).partial()
export type UpdateUserInputs = z.infer<typeof UpdateUserInputsSchema>
