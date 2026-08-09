import z from 'zod'

export const SessionUserSchema = z.object({
  id: z.uuidv7(),
  name: z.string(),
  email: z.email(),
})
export type SessionUser = z.infer<typeof SessionUserSchema>
