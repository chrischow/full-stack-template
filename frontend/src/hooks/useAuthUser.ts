import { useQuery } from '@tanstack/react-query'

import { orpc } from '@/app/orpc-client'

export const useAuthUser = () => {
  const { data, isLoading } = useQuery(orpc.auth.userinfo.queryOptions())

  return {
    user: data,
    isUserLoading: isLoading,
  }
}
