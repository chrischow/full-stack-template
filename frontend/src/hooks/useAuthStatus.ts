import { useMutation } from '@tanstack/react-query'

import { orpc } from '@/app/orpc-client'

export const useAuthStatus = () => {
  const { mutateAsync, isPending } = useMutation(orpc.auth.status.mutationOptions())

  return {
    getAuthStatus: mutateAsync,
    isAuthStatusLoading: isPending,
  }
}
