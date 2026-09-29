import { ORPCError } from '@orpc/client'
import { useMutation } from '@tanstack/react-query'

import { orpc } from '@/app/orpc-client'
import { toast } from '@/components/ui/toast'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ORPCError) {
    return error.data.body.message
  }
  return fallback
}

export const useOtp = () => {
  const { mutateAsync: generateOtp, isPending: isGeneratingOtp } = useMutation(
    orpc.auth.otp.generate.mutationOptions({
      onError: (error) => {
        toast.add({
          description: getErrorMessage(error, 'Could not request OTP.'),
          type: 'error',
        })
      },
    }),
  )
  const { mutateAsync: verifyOtp, isPending: isVerifyingOtp } = useMutation(
    orpc.auth.otp.verify.mutationOptions({
      onError: (error) => {
        toast.add({
          description: getErrorMessage(error, 'Failed to validate OTP. Please try again.'),
          type: 'error',
        })
      },
    }),
  )

  return {
    generateOtp,
    isGeneratingOtp,
    verifyOtp,
    isVerifyingOtp,
  }
}
