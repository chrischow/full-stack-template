import { oc } from '@orpc/contract'
import z from 'zod'

import { OtpLoginInputsSchema, OtpResponseSchema, OtpVerifyInputsSchema, SessionUserSchema } from '../schemas'

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
  oauth: oc.route({
    method: 'GET',
    path: '/auth/oauth',
    summary: 'Initiates OAuth',
    tags,
  }),
  oauthRedirect: oc.route({
    method: 'GET',
    path: '/auth/oauth/redirect',
    summary: 'OAuth redirect URL',
    successStatus: 302,
    outputStructure: 'detailed',
    tags,
  }),
  logout: oc.route({
    method: 'POST',
    path: '/auth/logout',
    summary: 'Logs a user out',
    tags,
  }),
  generateOtp: oc
    .route({
      method: 'POST',
      path: '/auth/otp/generate',
      summary: 'Requests OTP for signup or login',
      tags,
    })
    .input(OtpLoginInputsSchema)
    .output(OtpResponseSchema),
  verifyOtp: oc
    .route({
      method: 'POST',
      path: '/auth/otp/verify',
      summary: 'Verifies ',
      tags,
    })
    .input(OtpVerifyInputsSchema)
    .output(SessionUserSchema),
}
