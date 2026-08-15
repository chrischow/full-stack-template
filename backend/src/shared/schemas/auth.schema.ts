import z from 'zod'

export const SessionUserSchema = z.object({
  id: z.uuidv7(),
  name: z.string(),
  email: z.email(),
})
export type SessionUser = z.infer<typeof SessionUserSchema>

export const OtpLoginInputsSchema = z.object({
  email: z.email(),
})
export type OtpLoginInputs = z.infer<typeof OtpLoginInputsSchema>

export const OtpResponseSchema = z.object({
  canRequestAfter: z.coerce.date(),
})
export type OtpResponse = z.infer<typeof OtpResponseSchema>

export const OtpVerifyInputsSchema = z.object({
  email: z.email(),
  otp: z.string(),
})
export type OtpVerifyInputs = z.infer<typeof OtpVerifyInputsSchema>
