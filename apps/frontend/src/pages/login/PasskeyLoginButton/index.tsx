import { Button, Text } from '@chakra-ui/react'
import { ORPCError } from '@orpc/client'
import { startAuthentication } from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'
import { IoMdFingerPrint } from 'react-icons/io'
import { useNavigate } from 'react-router'

import { orpc } from '@/app/orpc-client'
import { toaster } from '@/components/ui/toaster'
import { useAuthContext } from '@/context/auth'

const PasskeyLoginButton = () => {
  const navigate = useNavigate()

  const { login } = useAuthContext()

  const { mutateAsync: verifyLogin, isPending: isLoginVerificationPending } = useMutation(
    orpc.auth.passkeys.login.verify.mutationOptions({
      onSuccess: (user) => {
        login(user)
        navigate('/')
      },
      onError: (error) => {
        if (error instanceof ORPCError) {
          toaster.create({
            description: <Text color="fg.error">{error.data.body.message}</Text>,
            duration: 3000,
          })
          return
        }
        toaster.create({
          description: <Text color="fg.error">Failed to log in with Passkey. Please try again.</Text>,
          duration: 3000,
        })
      },
    }),
  )
  const { mutateAsync: startLogin, isPending: isLoginPending } = useMutation(
    orpc.auth.passkeys.login.start.mutationOptions({
      onSuccess: async ({ identifier, options }) => {
        const credentials = await startAuthentication({ optionsJSON: options })
        await verifyLogin({ identifier, credentials })
      },
    }),
  )

  const handlePasskeyLogin = async () => {
    await startLogin({})
  }

  const isPending = isLoginVerificationPending || isLoginPending

  return (
    <Button w="full" colorPalette={'brand'} loading={isPending} onClick={handlePasskeyLogin}>
      <IoMdFingerPrint /> Login with Passkey
    </Button>
  )
}

export default PasskeyLoginButton
