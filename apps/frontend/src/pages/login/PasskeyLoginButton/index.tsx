import { ORPCError } from '@orpc/client'
import { startAuthentication } from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'
import { Loader } from 'lucide-react'
import { IoMdFingerPrint } from 'react-icons/io'
import { useNavigate } from 'react-router'

import { orpc } from '@/app/orpc-client'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
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
          toast.add({
            description: error.data.body.message,
            type: 'error',
          })
          return
        }
        toast.add({
          description: 'Failed to log in with Passkey. Please try again.',
          type: 'error',
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
    <Button className="w-full" onClick={handlePasskeyLogin}>
      {isPending && <Loader />}
      {!isPending && (
        <>
          <IoMdFingerPrint /> Login with Passkey
        </>
      )}
    </Button>
  )
}

export default PasskeyLoginButton
