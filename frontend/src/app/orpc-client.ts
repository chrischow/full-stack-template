import { createORPCClient, onError } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import type { JsonifiedClient } from '@orpc/openapi-client'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'

import { contract } from '~shared/contracts'

const link = new OpenAPILink(contract, {
  url: 'http://localhost:3000/api/v1',
  fetch: (request, init) => {
    return globalThis.fetch(request, {
      ...init,
    })
  },
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

const client: JsonifiedClient<ContractRouterClient<typeof contract>> = createORPCClient(link)
export const orpc = createTanstackQueryUtils(client)
