import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader } from 'lucide-react'

import { orpc } from '@/app/orpc-client'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'

const PasskeyRevokeButton = ({ passkeyId }: { passkeyId: string }) => {
  const queryClient = useQueryClient()

  const { mutate: revokePasskey, isPending: isPasskeyRevokePending } = useMutation(
    orpc.auth.passkeys.revoke.mutationOptions({
      onSuccess: async () => {
        toast.add({
          description: 'Revoked passkey.',
          type: 'success',
        })

        await queryClient.invalidateQueries({ queryKey: orpc.auth.passkeys.list.queryKey() })
      },
    }),
  )

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button size="xs" variant="destructive" disabled={isPasskeyRevokePending}>
            {isPasskeyRevokePending && <Loader />}
            {!isPasskeyRevokePending && 'Revoke'}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke Passkey</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to revoke this passkey on the app? The passkey on your device will no longer work, and
            you may safely delete it after this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            render={
              <Button type="button" variant="ghost">
                Close
              </Button>
            }
          />
          <Button variant="destructive" disabled={isPasskeyRevokePending} onClick={() => revokePasskey({ passkeyId })}>
            {isPasskeyRevokePending && <Loader />}
            {!isPasskeyRevokePending && 'Revoke'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default PasskeyRevokeButton
