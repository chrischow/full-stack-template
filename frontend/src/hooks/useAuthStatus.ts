import { useQuery } from '@tanstack/react-query'

import { orpc } from '@/app/orpc-client'

export const useAuthStatus = () => {
  const { data, isLoading } = useQuery(orpc.auth.status.queryOptions())

  return {
    authStatus: data ?? false,
    isAuthStatusLoading: isLoading,
  }
}
