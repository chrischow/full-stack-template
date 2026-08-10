import { useMutation } from '@tanstack/react-query'

import { orpc } from '@/app/orpc-client'

export const useLogout = () => {
  const { mutateAsync, isPending } = useMutation(orpc.auth.logout.mutationOptions())

  return {
    logoutUser: mutateAsync,
    isLogoutPending: isPending,
  }
}
