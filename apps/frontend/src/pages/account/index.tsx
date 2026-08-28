import { Button, Center, Heading, HStack, Spacer, Stack, Text } from '@chakra-ui/react'
import { ORPCError } from '@orpc/client'
import { startRegistration } from '@simplewebauthn/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BiPlus } from 'react-icons/bi'
import { IoMdFingerPrint } from 'react-icons/io'

import { orpc } from '@/app/orpc-client'
import { toaster } from '@/components/ui/toaster'
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
          toaster.create({
            description: <Text color="fg.error">{error.data.body.message}</Text>,
            duration: 3000,
          })
          return
        }
        toaster.create({
          description: <Text color="fg.error">Could not register passkey. Please try again.</Text>,
          duration: 3000,
        })
      },
    }),
  )

  const { data: passkeys, isPending: isPasskeysPending } = useQuery(orpc.auth.passkeys.list.queryOptions())

  return (
    <Stack px={6} py={4} gap={6} w="100%">
      <Heading size="3xl">Account</Heading>
      <Stack gap={4}>
        <HStack w="100%" align="center" gap={4}>
          <Heading size="xl">
            <HStack gap={1}>
              <IoMdFingerPrint /> Passkeys
            </HStack>
          </Heading>
          <Button
            size="2xs"
            variant="surface"
            onClick={() => registerPasskey({ email: user.email })}
            loading={isPasskeyRegistrationPending}
          >
            <BiPlus /> Add
          </Button>
        </HStack>
        {!isPasskeysPending && (!passkeys || passkeys.length === 0) && (
          <Center>
            <Text fontSize="sm" color="fg.subtle">
              No passkeys created.
            </Text>
          </Center>
        )}
        <Stack gap={2} w="100%">
          {passkeys &&
            passkeys.map((pk) => {
              return (
                <HStack key={pk.id} px={3} py={2} rounded="md" w="100%" borderWidth="1px">
                  <Text fontSize="sm" color="fg.muted">
                    {pk.name}
                  </Text>
                  <Spacer />
                  <PasskeyRevokeButton passkeyId={pk.id} />
                </HStack>
              )
            })}
        </Stack>
      </Stack>
    </Stack>
  )
}

export default AccountSettingsPage
