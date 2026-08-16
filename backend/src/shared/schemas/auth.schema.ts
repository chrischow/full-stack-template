import z from 'zod'

export const SessionUserSchema = z.object({
  id: z.uuidv7(),
  name: z.string(),
  email: z.email(),
})
export type SessionUser = z.infer<typeof SessionUserSchema>

export const EmailLoginInputsSchema = z.object({
  email: z.email(),
})
export type EmailLoginInputs = z.infer<typeof EmailLoginInputsSchema>

export const OtpResponseSchema = z.object({
  canRequestAfter: z.coerce.date(),
})
export type OtpResponse = z.infer<typeof OtpResponseSchema>

export const OtpVerifyInputsSchema = z.object({
  email: z.email(),
  otp: z.string(),
})
export type OtpVerifyInputs = z.infer<typeof OtpVerifyInputsSchema>

export const TransportSchema = z.enum(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'])

export const PasskeyRegistrationOptionsSchema = z.object({
  rp: z.object({
    id: z.string().optional(),
    name: z.string(),
  }),
  user: z.object({
    id: z.string(), // Base64URL string in JSON representation
    name: z.string(),
    displayName: z.string(),
  }),
  challenge: z.string(), // Base64URL string in JSON representation
  pubKeyCredParams: z.array(
    z.object({
      type: z.literal('public-key'),
      alg: z.number(),
    }),
  ),
  timeout: z.number().positive().optional(),
  excludeCredentials: z
    .array(
      z.object({
        type: z.literal('public-key'),
        id: z.string(), // Base64URL string in JSON representation
        transports: z.array(TransportSchema).optional(),
      }),
    )
    .optional(),
  authenticatorSelection: z
    .object({
      authenticatorAttachment: z.enum(['cross-platform', 'platform']).optional(),
      residentKey: z.enum(['discouraged', 'preferred', 'required']).optional(),
      requireResidentKey: z.boolean().optional(),
      userVerification: z.enum(['discouraged', 'preferred', 'required']).optional(),
    })
    .optional(),
  attestation: z.enum(['direct', 'enterprise', 'none', 'indirect']).optional(),
  extensions: z.record(z.any(), z.any()).optional(),
})

export type PasskeyRegistrationOptions = z.infer<typeof PasskeyRegistrationOptionsSchema>

export const PasskeyRegistrationInputsSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  response: z.object({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
    transports: z.array(TransportSchema).optional(),
    authenticatorData: z.string().optional(),
    publicKey: z.string().optional(),
    publicKeyAlgorithm: z.number().optional(),
  }),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.object({
    appid: z.boolean().optional(),
    credProps: z
      .object({
        rk: z.boolean().optional(),
      })
      .optional(),
    largeBlob: z
      .object({
        blob: z.string().optional(),
        supported: z.boolean().optional(),
        written: z.boolean().optional(),
      })
      .optional(),
    hmacCreateSecret: z.boolean().optional(),
    prf: z
      .object({
        enabled: z.boolean().optional(),
        results: {
          first: z.custom<BufferSource>(),
          second: z.custom<BufferSource>().optional(),
        },
      })
      .optional(),
  }),
  type: z.literal('public-key'),
})
export type PasskeyRegistrationInputs = z.infer<typeof PasskeyRegistrationInputsSchema>

export const PasskeyAuthenticationOptionsSchema = z.object({
  challenge: z.string().regex(/^[A-Za-z0-9_-]+$/),
  timeout: z.int().positive().optional(),
  rpId: z.string().optional(),
  allowCredentials: z
    .array(
      z.object({
        type: z.literal('public-key'),
        id: z.string().regex(/^[A-Za-z0-9_-]+$/),
        transports: z.array(z.enum(['usb', 'nfc', 'ble', 'internal', 'hybrid'])).optional(),
      }),
    )
    .optional(),
  userVerification: z.enum(['required', 'preferred', 'discouraged']).optional(),
  hints: z.array(z.enum(['hybrid', 'security-key', 'client-device'])).optional(),
  extensions: z.record(z.any(), z.unknown()).optional(),
})
export type PasskeyAuthenticationOptions = z.infer<typeof PasskeyAuthenticationOptionsSchema>

export const PasskeyAuthenticationCredentialsSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  response: z.object({
    authenticatorData: z.string().min(1),
    clientDataJSON: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().optional(),
    attestationObject: z.string().optional(),
  }),
  type: z.literal('public-key'),
  clientExtensionResults: z.record(z.any(), z.any()),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
})
export type PasskeyAuthenticationCredentials = z.infer<typeof PasskeyAuthenticationCredentialsSchema>

export const PasskeyAuthenticationInputsSchema = z.object({
  identifier: z.string(),
  credentials: PasskeyAuthenticationCredentialsSchema,
})
export type PasskeyAuthenticationInputs = z.infer<typeof PasskeyAuthenticationInputsSchema>

export const PasskeySchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type Passkey = z.infer<typeof PasskeySchema>

export const ListPasskeysSchema = z.object({
  passkeys: z.array(PasskeySchema),
})
export type ListPasskeys = z.infer<typeof ListPasskeysSchema>
