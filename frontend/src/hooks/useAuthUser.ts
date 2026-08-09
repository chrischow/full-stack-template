import { useMutation } from '@tanstack/react-query'

import { orpc } from '@/app/orpc-client'

export const useAuthUser = () => {
  const { mutateAsync, isPending } = useMutation(orpc.auth.userinfo.mutationOptions())

  return {
    getUser: mutateAsync,
    isUserPending: isPending,
  }
}
