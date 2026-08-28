import { useMutation } from '@tanstack/react-query'

import { orpc } from '@/app/orpc-client'

export const useAuth = () => {
  const { mutateAsync: getAuthStatus, isPending: isAuthStatusLoading } = useMutation(orpc.auth.status.mutationOptions())
  const { mutateAsync: getUser, isPending: isUserPending } = useMutation(orpc.auth.userinfo.mutationOptions())
  const { mutateAsync: logoutUser, isPending: isLogoutPending } = useMutation(orpc.auth.logout.mutationOptions())

  return {
    getAuthStatus,
    isAuthStatusLoading,
    getUser,
    isUserPending,
    logoutUser,
    isLogoutPending,
  }
}
