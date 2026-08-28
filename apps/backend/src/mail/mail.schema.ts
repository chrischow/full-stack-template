import z from 'zod'

export const SendMailInputsSchema = z.object({
  from: z.email(),
  to: z.email(),
  subject: z.string(),
  html: z.string(),
})
export type SendMailInputs = z.infer<typeof SendMailInputsSchema>
