import { oc } from '@orpc/contract'
import z from 'zod'

import {
  EmailLoginInputsSchema,
  OtpResponseSchema,
  OtpVerifyInputsSchema,
  PasskeyAuthenticationInputsSchema,
  PasskeyAuthenticationOptionsSchema,
  PasskeyRegistrationInputsSchema,
  PasskeyRegistrationOptionsSchema,
  PasskeySchema,
  SessionUserSchema,
} from '../schemas/index.js'

const tags = ['Auth']

export const authContract = {
  status: oc
    .route({
      method: 'GET',
      path: '/auth/status',
      summary: "Returns the user's authentication status",
      tags,
    })
    .output(z.boolean()),
  userinfo: oc
    .route({
      method: 'GET',
      path: '/auth/userinfo',
      summary: 'Returns the authenticated user',
      tags,
    })
    .output(SessionUserSchema),
  logout: oc.route({
    method: 'POST',
    path: '/auth/logout',
    summary: 'Logs a user out',
    tags,
  }),
  oauth: {
    login: oc.route({
      method: 'GET',
      path: '/auth/oauth',
      summary: 'Initiates OAuth',
      tags,
    }),
    redirect: oc.route({
      method: 'GET',
      path: '/auth/oauth/redirect',
      summary: 'OAuth redirect URL',
      successStatus: 302,
      outputStructure: 'detailed',
      tags,
    }),
  },
  otp: {
    generate: oc
      .route({
        method: 'POST',
        path: '/auth/otp/generate',
        summary: 'Requests OTP for signup or login',
        tags,
      })
      .input(EmailLoginInputsSchema)
      .output(OtpResponseSchema),
    verify: oc
      .route({
        method: 'POST',
        path: '/auth/otp/verify',
        summary: 'Verifies ',
        tags,
      })
      .input(OtpVerifyInputsSchema)
      .output(SessionUserSchema),
  },
  passkeys: {
    list: oc
      .route({
        method: 'GET',
        path: '/auth/passkeys',
        summary: "Lists the authenticated user's passkeys",
        tags,
      })
      .output(z.array(PasskeySchema)),
    revoke: oc
      .route({
        method: 'POST',
        path: '/auth/passkeys/{passkeyId}/revoke',
        summary: "Lists the authenticated user's passkeys",
        tags,
      })
      .input(z.object({ passkeyId: z.string() })),
    register: {
      start: oc
        .route({
          method: 'POST',
          path: '/auth/passkeys/register',
          summary: 'Starts registration for Passkey',
          tags,
        })
        .output(PasskeyRegistrationOptionsSchema),
      verify: oc
        .route({
          method: 'POST',
          path: '/auth/passkeys/register/verify',
          summary: 'Completes verification of Passkey',
          tags,
        })
        .input(PasskeyRegistrationInputsSchema)
        .output(z.boolean()),
    },
    login: {
      start: oc
        .route({
          method: 'GET',
          path: '/auth/passkeys/login',
          summary: 'Starts login via Passkey',
          tags,
        })
        .output(z.object({ identifier: z.uuidv4(), options: PasskeyAuthenticationOptionsSchema })),
      verify: oc
        .route({
          method: 'POST',
          path: '/auth/passkeys/login/verify',
          summary: 'Completes login via Passkey',
          tags,
        })
        .input(PasskeyAuthenticationInputsSchema)
        .output(SessionUserSchema),
    },
  },
}
