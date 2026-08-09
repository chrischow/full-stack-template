import { oc } from '@orpc/contract'
import z from 'zod'

import { SessionUserSchema } from '../schemas'

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
}
