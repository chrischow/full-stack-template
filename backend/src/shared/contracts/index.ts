import { populateContractRouterPaths } from '@orpc/contract'

import { authContract } from './auth.contract'

export const contract = populateContractRouterPaths({
  auth: authContract,
})
