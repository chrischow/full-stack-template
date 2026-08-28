import z from 'zod'
export declare const SessionUserSchema: z.ZodObject<
  {
    id: z.ZodUUID
    name: z.ZodString
    email: z.ZodEmail
  },
  z.z.core.$strip
>
export type SessionUser = z.infer<typeof SessionUserSchema>
export declare const EmailLoginInputsSchema: z.ZodObject<
  {
    email: z.ZodEmail
  },
  z.z.core.$strip
>
export type EmailLoginInputs = z.infer<typeof EmailLoginInputsSchema>
export declare const OtpResponseSchema: z.ZodObject<
  {
    canRequestAfter: z.z.ZodCoercedDate<unknown>
  },
  z.z.core.$strip
>
export type OtpResponse = z.infer<typeof OtpResponseSchema>
export declare const OtpVerifyInputsSchema: z.ZodObject<
  {
    email: z.ZodEmail
    otp: z.ZodString
  },
  z.z.core.$strip
>
export type OtpVerifyInputs = z.infer<typeof OtpVerifyInputsSchema>
export declare const TransportSchema: z.ZodEnum<{
  ble: 'ble'
  cable: 'cable'
  hybrid: 'hybrid'
  internal: 'internal'
  nfc: 'nfc'
  'smart-card': 'smart-card'
  usb: 'usb'
}>
export declare const PasskeyRegistrationOptionsSchema: z.ZodObject<
  {
    rp: z.ZodObject<
      {
        id: z.ZodOptional<z.ZodString>
        name: z.ZodString
      },
      z.z.core.$strip
    >
    user: z.ZodObject<
      {
        id: z.ZodString
        name: z.ZodString
        displayName: z.ZodString
      },
      z.z.core.$strip
    >
    challenge: z.ZodString
    pubKeyCredParams: z.ZodArray<
      z.ZodObject<
        {
          type: z.ZodLiteral<'public-key'>
          alg: z.ZodNumber
        },
        z.z.core.$strip
      >
    >
    timeout: z.ZodOptional<z.ZodNumber>
    excludeCredentials: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            type: z.ZodLiteral<'public-key'>
            id: z.ZodString
            transports: z.ZodOptional<
              z.ZodArray<
                z.ZodEnum<{
                  ble: 'ble'
                  cable: 'cable'
                  hybrid: 'hybrid'
                  internal: 'internal'
                  nfc: 'nfc'
                  'smart-card': 'smart-card'
                  usb: 'usb'
                }>
              >
            >
          },
          z.z.core.$strip
        >
      >
    >
    authenticatorSelection: z.ZodOptional<
      z.ZodObject<
        {
          authenticatorAttachment: z.ZodOptional<
            z.ZodEnum<{
              'cross-platform': 'cross-platform'
              platform: 'platform'
            }>
          >
          residentKey: z.ZodOptional<
            z.ZodEnum<{
              discouraged: 'discouraged'
              preferred: 'preferred'
              required: 'required'
            }>
          >
          requireResidentKey: z.ZodOptional<z.ZodBoolean>
          userVerification: z.ZodOptional<
            z.ZodEnum<{
              discouraged: 'discouraged'
              preferred: 'preferred'
              required: 'required'
            }>
          >
        },
        z.z.core.$strip
      >
    >
    attestation: z.ZodOptional<
      z.ZodEnum<{
        direct: 'direct'
        enterprise: 'enterprise'
        none: 'none'
        indirect: 'indirect'
      }>
    >
    extensions: z.ZodOptional<z.ZodRecord<z.ZodAny, z.ZodAny>>
  },
  z.z.core.$strip
>
export type PasskeyRegistrationOptions = z.infer<typeof PasskeyRegistrationOptionsSchema>
export declare const PasskeyRegistrationInputsSchema: z.ZodObject<
  {
    id: z.ZodString
    rawId: z.ZodString
    response: z.ZodObject<
      {
        clientDataJSON: z.ZodString
        attestationObject: z.ZodString
        transports: z.ZodOptional<
          z.ZodArray<
            z.ZodEnum<{
              ble: 'ble'
              cable: 'cable'
              hybrid: 'hybrid'
              internal: 'internal'
              nfc: 'nfc'
              'smart-card': 'smart-card'
              usb: 'usb'
            }>
          >
        >
        authenticatorData: z.ZodOptional<z.ZodString>
        publicKey: z.ZodOptional<z.ZodString>
        publicKeyAlgorithm: z.ZodOptional<z.ZodNumber>
      },
      z.z.core.$strip
    >
    authenticatorAttachment: z.ZodOptional<
      z.ZodEnum<{
        'cross-platform': 'cross-platform'
        platform: 'platform'
      }>
    >
    clientExtensionResults: z.ZodObject<
      {
        appid: z.ZodOptional<z.ZodBoolean>
        credProps: z.ZodOptional<
          z.ZodObject<
            {
              rk: z.ZodOptional<z.ZodBoolean>
            },
            z.z.core.$strip
          >
        >
        largeBlob: z.ZodOptional<
          z.ZodObject<
            {
              blob: z.ZodOptional<z.ZodString>
              supported: z.ZodOptional<z.ZodBoolean>
              written: z.ZodOptional<z.ZodBoolean>
            },
            z.z.core.$strip
          >
        >
        hmacCreateSecret: z.ZodOptional<z.ZodBoolean>
        prf: z.ZodOptional<
          z.ZodObject<
            {
              enabled: z.ZodOptional<z.ZodBoolean>
              results: {
                first: z.ZodCustom<BufferSource, BufferSource>
                second: z.ZodOptional<z.ZodCustom<BufferSource, BufferSource>>
              }
            },
            z.z.core.$strip
          >
        >
      },
      z.z.core.$strip
    >
    type: z.ZodLiteral<'public-key'>
  },
  z.z.core.$strip
>
export type PasskeyRegistrationInputs = z.infer<typeof PasskeyRegistrationInputsSchema>
export declare const PasskeyAuthenticationOptionsSchema: z.ZodObject<
  {
    challenge: z.ZodString
    timeout: z.ZodOptional<z.ZodInt>
    rpId: z.ZodOptional<z.ZodString>
    allowCredentials: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            type: z.ZodLiteral<'public-key'>
            id: z.ZodString
            transports: z.ZodOptional<
              z.ZodArray<
                z.ZodEnum<{
                  ble: 'ble'
                  hybrid: 'hybrid'
                  internal: 'internal'
                  nfc: 'nfc'
                  usb: 'usb'
                }>
              >
            >
          },
          z.z.core.$strip
        >
      >
    >
    userVerification: z.ZodOptional<
      z.ZodEnum<{
        discouraged: 'discouraged'
        preferred: 'preferred'
        required: 'required'
      }>
    >
    hints: z.ZodOptional<
      z.ZodArray<
        z.ZodEnum<{
          hybrid: 'hybrid'
          'security-key': 'security-key'
          'client-device': 'client-device'
        }>
      >
    >
    extensions: z.ZodOptional<z.ZodRecord<z.ZodAny, z.ZodUnknown>>
  },
  z.z.core.$strip
>
export type PasskeyAuthenticationOptions = z.infer<typeof PasskeyAuthenticationOptionsSchema>
export declare const PasskeyAuthenticationCredentialsSchema: z.ZodObject<
  {
    id: z.ZodString
    rawId: z.ZodString
    response: z.ZodObject<
      {
        authenticatorData: z.ZodString
        clientDataJSON: z.ZodString
        signature: z.ZodString
        userHandle: z.ZodOptional<z.ZodString>
        attestationObject: z.ZodOptional<z.ZodString>
      },
      z.z.core.$strip
    >
    type: z.ZodLiteral<'public-key'>
    clientExtensionResults: z.ZodRecord<z.ZodAny, z.ZodAny>
    authenticatorAttachment: z.ZodOptional<
      z.ZodEnum<{
        'cross-platform': 'cross-platform'
        platform: 'platform'
      }>
    >
  },
  z.z.core.$strip
>
export type PasskeyAuthenticationCredentials = z.infer<typeof PasskeyAuthenticationCredentialsSchema>
export declare const PasskeyAuthenticationInputsSchema: z.ZodObject<
  {
    identifier: z.ZodString
    credentials: z.ZodObject<
      {
        id: z.ZodString
        rawId: z.ZodString
        response: z.ZodObject<
          {
            authenticatorData: z.ZodString
            clientDataJSON: z.ZodString
            signature: z.ZodString
            userHandle: z.ZodOptional<z.ZodString>
            attestationObject: z.ZodOptional<z.ZodString>
          },
          z.z.core.$strip
        >
        type: z.ZodLiteral<'public-key'>
        clientExtensionResults: z.ZodRecord<z.ZodAny, z.ZodAny>
        authenticatorAttachment: z.ZodOptional<
          z.ZodEnum<{
            'cross-platform': 'cross-platform'
            platform: 'platform'
          }>
        >
      },
      z.z.core.$strip
    >
  },
  z.z.core.$strip
>
export type PasskeyAuthenticationInputs = z.infer<typeof PasskeyAuthenticationInputsSchema>
export declare const PasskeySchema: z.ZodObject<
  {
    id: z.ZodString
    name: z.ZodString
  },
  z.z.core.$strip
>
export type Passkey = z.infer<typeof PasskeySchema>
//# sourceMappingURL=auth.schema.d.ts.map
