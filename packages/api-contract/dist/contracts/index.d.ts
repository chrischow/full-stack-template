export declare const contract: {
  auth: {
    status: import('@orpc/contract').ContractProcedure<
      import('@orpc/contract').Schema<unknown, unknown>,
      import('zod').ZodBoolean,
      Record<never, never>,
      Record<never, never>
    >
    userinfo: import('@orpc/contract').ContractProcedure<
      import('@orpc/contract').Schema<unknown, unknown>,
      import('zod').ZodObject<
        {
          id: import('zod').ZodUUID
          name: import('zod').ZodString
          email: import('zod').ZodEmail
        },
        import('zod/v4/core').$strip
      >,
      Record<never, never>,
      Record<never, never>
    >
    logout: import('@orpc/contract').ContractProcedure<
      import('@orpc/contract').Schema<unknown, unknown>,
      import('@orpc/contract').Schema<unknown, unknown>,
      Record<never, never>,
      Record<never, never>
    >
    oauth: {
      login: import('@orpc/contract').ContractProcedure<
        import('@orpc/contract').Schema<unknown, unknown>,
        import('@orpc/contract').Schema<unknown, unknown>,
        Record<never, never>,
        Record<never, never>
      >
      redirect: import('@orpc/contract').ContractProcedure<
        import('@orpc/contract').Schema<unknown, unknown>,
        import('@orpc/contract').Schema<unknown, unknown>,
        Record<never, never>,
        Record<never, never>
      >
    }
    otp: {
      generate: import('@orpc/contract').ContractProcedure<
        import('zod').ZodObject<
          {
            email: import('zod').ZodEmail
          },
          import('zod/v4/core').$strip
        >,
        import('zod').ZodObject<
          {
            canRequestAfter: import('zod').ZodCoercedDate<unknown>
          },
          import('zod/v4/core').$strip
        >,
        Record<never, never>,
        Record<never, never>
      >
      verify: import('@orpc/contract').ContractProcedure<
        import('zod').ZodObject<
          {
            email: import('zod').ZodEmail
            otp: import('zod').ZodString
          },
          import('zod/v4/core').$strip
        >,
        import('zod').ZodObject<
          {
            id: import('zod').ZodUUID
            name: import('zod').ZodString
            email: import('zod').ZodEmail
          },
          import('zod/v4/core').$strip
        >,
        Record<never, never>,
        Record<never, never>
      >
    }
    passkeys: {
      list: import('@orpc/contract').ContractProcedure<
        import('@orpc/contract').Schema<unknown, unknown>,
        import('zod').ZodArray<
          import('zod').ZodObject<
            {
              id: import('zod').ZodString
              name: import('zod').ZodString
            },
            import('zod/v4/core').$strip
          >
        >,
        Record<never, never>,
        Record<never, never>
      >
      revoke: import('@orpc/contract').ContractProcedure<
        import('zod').ZodObject<
          {
            passkeyId: import('zod').ZodString
          },
          import('zod/v4/core').$strip
        >,
        import('@orpc/contract').Schema<unknown, unknown>,
        Record<never, never>,
        Record<never, never>
      >
      register: {
        start: import('@orpc/contract').ContractProcedure<
          import('@orpc/contract').Schema<unknown, unknown>,
          import('zod').ZodObject<
            {
              rp: import('zod').ZodObject<
                {
                  id: import('zod').ZodOptional<import('zod').ZodString>
                  name: import('zod').ZodString
                },
                import('zod/v4/core').$strip
              >
              user: import('zod').ZodObject<
                {
                  id: import('zod').ZodString
                  name: import('zod').ZodString
                  displayName: import('zod').ZodString
                },
                import('zod/v4/core').$strip
              >
              challenge: import('zod').ZodString
              pubKeyCredParams: import('zod').ZodArray<
                import('zod').ZodObject<
                  {
                    type: import('zod').ZodLiteral<'public-key'>
                    alg: import('zod').ZodNumber
                  },
                  import('zod/v4/core').$strip
                >
              >
              timeout: import('zod').ZodOptional<import('zod').ZodNumber>
              excludeCredentials: import('zod').ZodOptional<
                import('zod').ZodArray<
                  import('zod').ZodObject<
                    {
                      type: import('zod').ZodLiteral<'public-key'>
                      id: import('zod').ZodString
                      transports: import('zod').ZodOptional<
                        import('zod').ZodArray<
                          import('zod').ZodEnum<{
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
                    import('zod/v4/core').$strip
                  >
                >
              >
              authenticatorSelection: import('zod').ZodOptional<
                import('zod').ZodObject<
                  {
                    authenticatorAttachment: import('zod').ZodOptional<
                      import('zod').ZodEnum<{
                        'cross-platform': 'cross-platform'
                        platform: 'platform'
                      }>
                    >
                    residentKey: import('zod').ZodOptional<
                      import('zod').ZodEnum<{
                        discouraged: 'discouraged'
                        preferred: 'preferred'
                        required: 'required'
                      }>
                    >
                    requireResidentKey: import('zod').ZodOptional<import('zod').ZodBoolean>
                    userVerification: import('zod').ZodOptional<
                      import('zod').ZodEnum<{
                        discouraged: 'discouraged'
                        preferred: 'preferred'
                        required: 'required'
                      }>
                    >
                  },
                  import('zod/v4/core').$strip
                >
              >
              attestation: import('zod').ZodOptional<
                import('zod').ZodEnum<{
                  direct: 'direct'
                  enterprise: 'enterprise'
                  none: 'none'
                  indirect: 'indirect'
                }>
              >
              extensions: import('zod').ZodOptional<import('zod').ZodRecord<import('zod').ZodAny, import('zod').ZodAny>>
            },
            import('zod/v4/core').$strip
          >,
          Record<never, never>,
          Record<never, never>
        >
        verify: import('@orpc/contract').ContractProcedure<
          import('zod').ZodObject<
            {
              id: import('zod').ZodString
              rawId: import('zod').ZodString
              response: import('zod').ZodObject<
                {
                  clientDataJSON: import('zod').ZodString
                  attestationObject: import('zod').ZodString
                  transports: import('zod').ZodOptional<
                    import('zod').ZodArray<
                      import('zod').ZodEnum<{
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
                  authenticatorData: import('zod').ZodOptional<import('zod').ZodString>
                  publicKey: import('zod').ZodOptional<import('zod').ZodString>
                  publicKeyAlgorithm: import('zod').ZodOptional<import('zod').ZodNumber>
                },
                import('zod/v4/core').$strip
              >
              authenticatorAttachment: import('zod').ZodOptional<
                import('zod').ZodEnum<{
                  'cross-platform': 'cross-platform'
                  platform: 'platform'
                }>
              >
              clientExtensionResults: import('zod').ZodObject<
                {
                  appid: import('zod').ZodOptional<import('zod').ZodBoolean>
                  credProps: import('zod').ZodOptional<
                    import('zod').ZodObject<
                      {
                        rk: import('zod').ZodOptional<import('zod').ZodBoolean>
                      },
                      import('zod/v4/core').$strip
                    >
                  >
                  largeBlob: import('zod').ZodOptional<
                    import('zod').ZodObject<
                      {
                        blob: import('zod').ZodOptional<import('zod').ZodString>
                        supported: import('zod').ZodOptional<import('zod').ZodBoolean>
                        written: import('zod').ZodOptional<import('zod').ZodBoolean>
                      },
                      import('zod/v4/core').$strip
                    >
                  >
                  hmacCreateSecret: import('zod').ZodOptional<import('zod').ZodBoolean>
                  prf: import('zod').ZodOptional<
                    import('zod').ZodObject<
                      {
                        enabled: import('zod').ZodOptional<import('zod').ZodBoolean>
                        results: {
                          first: import('zod').ZodCustom<BufferSource, BufferSource>
                          second: import('zod').ZodOptional<import('zod').ZodCustom<BufferSource, BufferSource>>
                        }
                      },
                      import('zod/v4/core').$strip
                    >
                  >
                },
                import('zod/v4/core').$strip
              >
              type: import('zod').ZodLiteral<'public-key'>
            },
            import('zod/v4/core').$strip
          >,
          import('zod').ZodBoolean,
          Record<never, never>,
          Record<never, never>
        >
      }
      login: {
        start: import('@orpc/contract').ContractProcedure<
          import('@orpc/contract').Schema<unknown, unknown>,
          import('zod').ZodObject<
            {
              identifier: import('zod').ZodUUID
              options: import('zod').ZodObject<
                {
                  challenge: import('zod').ZodString
                  timeout: import('zod').ZodOptional<import('zod').ZodInt>
                  rpId: import('zod').ZodOptional<import('zod').ZodString>
                  allowCredentials: import('zod').ZodOptional<
                    import('zod').ZodArray<
                      import('zod').ZodObject<
                        {
                          type: import('zod').ZodLiteral<'public-key'>
                          id: import('zod').ZodString
                          transports: import('zod').ZodOptional<
                            import('zod').ZodArray<
                              import('zod').ZodEnum<{
                                ble: 'ble'
                                hybrid: 'hybrid'
                                internal: 'internal'
                                nfc: 'nfc'
                                usb: 'usb'
                              }>
                            >
                          >
                        },
                        import('zod/v4/core').$strip
                      >
                    >
                  >
                  userVerification: import('zod').ZodOptional<
                    import('zod').ZodEnum<{
                      discouraged: 'discouraged'
                      preferred: 'preferred'
                      required: 'required'
                    }>
                  >
                  hints: import('zod').ZodOptional<
                    import('zod').ZodArray<
                      import('zod').ZodEnum<{
                        hybrid: 'hybrid'
                        'security-key': 'security-key'
                        'client-device': 'client-device'
                      }>
                    >
                  >
                  extensions: import('zod').ZodOptional<
                    import('zod').ZodRecord<import('zod').ZodAny, import('zod').ZodUnknown>
                  >
                },
                import('zod/v4/core').$strip
              >
            },
            import('zod/v4/core').$strip
          >,
          Record<never, never>,
          Record<never, never>
        >
        verify: import('@orpc/contract').ContractProcedure<
          import('zod').ZodObject<
            {
              identifier: import('zod').ZodString
              credentials: import('zod').ZodObject<
                {
                  id: import('zod').ZodString
                  rawId: import('zod').ZodString
                  response: import('zod').ZodObject<
                    {
                      authenticatorData: import('zod').ZodString
                      clientDataJSON: import('zod').ZodString
                      signature: import('zod').ZodString
                      userHandle: import('zod').ZodOptional<import('zod').ZodString>
                      attestationObject: import('zod').ZodOptional<import('zod').ZodString>
                    },
                    import('zod/v4/core').$strip
                  >
                  type: import('zod').ZodLiteral<'public-key'>
                  clientExtensionResults: import('zod').ZodRecord<import('zod').ZodAny, import('zod').ZodAny>
                  authenticatorAttachment: import('zod').ZodOptional<
                    import('zod').ZodEnum<{
                      'cross-platform': 'cross-platform'
                      platform: 'platform'
                    }>
                  >
                },
                import('zod/v4/core').$strip
              >
            },
            import('zod/v4/core').$strip
          >,
          import('zod').ZodObject<
            {
              id: import('zod').ZodUUID
              name: import('zod').ZodString
              email: import('zod').ZodEmail
            },
            import('zod/v4/core').$strip
          >,
          Record<never, never>,
          Record<never, never>
        >
      }
    }
  }
}
//# sourceMappingURL=index.d.ts.map
