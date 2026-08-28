import z from 'zod'
export const UuidSchema = z.object({
  id: z.uuidv7(),
})
