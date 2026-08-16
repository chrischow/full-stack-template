import { Button, CloseButton, Dialog, Portal, Text } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { orpc } from '@/app/orpc-client'
import { toaster } from '@/components/ui/toaster'

const PasskeyRevokeButton = ({ passkeyId }: { passkeyId: string }) => {
  const queryClient = useQueryClient()

  const { mutate: revokePasskey, isPending: isPasskeyRevokePending } = useMutation(
    orpc.auth.passkeys.revoke.mutationOptions({
      onSuccess: async () => {
        toaster.create({
          description: <Text color="fg.success">Revoked passkey.</Text>,
          duration: 3000,
        })

        await queryClient.invalidateQueries({ queryKey: orpc.auth.passkeys.list.queryKey() })
      },
    }),
  )

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button size="2xs" variant="surface" colorPalette="red" loading={isPasskeyRevokePending}>
          Revoke
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Revoke Passkey</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                Are you sure you want to revoke this passkey on the app? The passkey on your device will no longer work,
                and you may safely delete it after this.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="critical"
                loading={isPasskeyRevokePending}
                onClick={() => revokePasskey({ passkeyId })}
              >
                Revoke
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

export default PasskeyRevokeButton
