import { ORPCError } from '@orpc/client'
import { startRegistration } from '@simplewebauthn/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader } from 'lucide-react'
import { BiPlus } from 'react-icons/bi'
import { IoMdFingerPrint } from 'react-icons/io'

import { orpc } from '@/app/orpc-client'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { useAuthContext } from '@/context/auth'

import PasskeyRevokeButton from './PasskeyRevokeButton'

const AccountSettingsPage = () => {
  const queryClient = useQueryClient()

  const { user } = useAuthContext()
  const { mutateAsync: verifyRegistration } = useMutation(orpc.auth.passkeys.register.verify.mutationOptions())

  const { mutate: registerPasskey, isPending: isPasskeyRegistrationPending } = useMutation(
    orpc.auth.passkeys.register.start.mutationOptions({
      onSuccess: async (options) => {
        const credentials = await startRegistration({ optionsJSON: options })
        await verifyRegistration(credentials)
        await queryClient.invalidateQueries({ queryKey: orpc.auth.passkeys.list.queryKey() })
      },
      onError: (error) => {
        if (error instanceof ORPCError) {
          toast.add({
            description: <p color="red.500">{error.data.body.message}</p>,
          })
          return
        }
        toast.add({
          description: <p color="red.500">Could not register passkey. Please try again.</p>,
        })
      },
    }),
  )

  const { data: passkeys, isPending: isPasskeysPending } = useQuery(orpc.auth.passkeys.list.queryOptions())

  return (
    <div className="flex flex-col w-full px-6 py-4 gap-6">
      <div className="flex flex-col w-full gap-4">
        <h1 className="text-3xl font-bold">Account</h1>
        <div className="flex flex-row gap-4">
          <div className="flex flex-row gap-2 text-2xl content-center">
            <IoMdFingerPrint />
            <h2 className="text-2xl font-semibold">Passkeys</h2>
          </div>
          <Button
            className="text-xs"
            onClick={() => registerPasskey({ email: user.email })}
            disabled={isPasskeyRegistrationPending}
          >
            {isPasskeyRegistrationPending && <Loader />}
            {!isPasskeyRegistrationPending && (
              <>
                <BiPlus /> Add
              </>
            )}
          </Button>
        </div>
        {!isPasskeysPending && (!passkeys || passkeys.length === 0) && (
          <div className="flex flex-col w-full text-center">
            <p className="font-sm text-gray-400">No passkeys created.</p>
          </div>
        )}
        {passkeys &&
          passkeys.map((pk) => {
            return (
              <div key={pk.id} className="flex flex-row px-3 py-2 rounded-md w-full border justify-between">
                <p className="text-sm gray-400">{pk.name}</p>
                <PasskeyRevokeButton passkeyId={pk.id} />
              </div>
            )
          })}
      </div>
    </div>
  )
}

export default AccountSettingsPage
