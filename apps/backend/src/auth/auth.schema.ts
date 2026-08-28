import z from 'zod'

export const OtpSchema = z.object({
  value: z.string(),
  retries: z.number(),
})
export type Otp = z.infer<typeof OtpSchema>
