import { ORPCError } from '@orpc/client'
import { EmailLoginInputsSchema, OtpResponseSchema } from '@repo/api-contract/schemas'
import { useMutation } from '@tanstack/react-query'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { Loader } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { orpc } from '@/app/orpc-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { toast } from '@/components/ui/toast'
import { useAuthContext } from '@/context/auth'

const OtpPage = () => {
  const navigate = useNavigate()
  const { login } = useAuthContext()

  const [isOtpRequested, setIsOtpRequested] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState<string>('')
  const [canRequestAfter, setCanRequestAfter] = useState<Date>()

  const { mutateAsync: requestOtp, isPending: isOtpRequestPending } = useMutation(
    orpc.auth.otp.generate.mutationOptions({
      onSuccess: (response) => {
        const { success, data } = OtpResponseSchema.safeParse(response)
        if (!success) {
          toast.add({
            description: 'Failed to generate OTP.',
            type: 'error',
          })
          return
        }
        setCanRequestAfter(data.canRequestAfter)
        setIsOtpRequested(true)
      },
      onError: (error) => {
        let description = 'Could not request OTP.'
        if (error instanceof ORPCError) {
          description = error.data.body.message
        }
        toast.add({
          description,
          type: 'error',
        })
      },
    }),
  )

  const { mutateAsync: verifyOtp, isPending: isOtpVerifyPending } = useMutation(
    orpc.auth.otp.verify.mutationOptions({
      onSuccess: (user) => {
        toast.add({
          description: 'Logged in successfully.',
          type: 'success',
        })

        login(user)

        navigate('/')
      },
      onError: (error) => {
        setOtp('')
        if (error instanceof ORPCError) {
          toast.add({
            description: error.data.body.message,
            type: 'error',
          })
          return
        }
        toast.add({
          description: 'Failed to validate OTP. Please try again.',
          type: 'error',
        })
      },
    }),
  )

  const handleRequestOtp = async () => {
    const { success } = EmailLoginInputsSchema.safeParse({ email })
    if (!success) {
      toast.add({
        description: 'Please input a valid email.',
        type: 'error',
      })
      return
    }
    setOtp('')
    await requestOtp({ email })
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.add({
        description: 'Invalid OTP.',
        type: 'error',
      })
    }
    await verifyOtp({ email, otp })
  }

  const canRequestOtp = canRequestAfter ? new Date().getTime() >= canRequestAfter.getTime() : false
  const isOtpValid = otp.length === 6

  return (
    <div className="w-dvw h-dvh flex flex-col justify-center content-center">
      <Card className="w-md self-center">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold">Full Stack Template</CardTitle>
        </CardHeader>
        <CardContent className="justify-center">
          {!isOtpRequested && (
            <>
              <Input
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="Enter your email"
                autoFocus={true}
                onKeyDown={(e) => {
                  if (e.code === 'Enter') {
                    handleRequestOtp()
                  }
                }}
              />
              <Button className="w-full" disabled={isOtpRequestPending} onClick={handleRequestOtp}>
                {isOtpRequestPending && <Loader />}
                {!isOtpRequestPending && 'Request OTP'}
              </Button>
            </>
          )}
          {isOtpRequested && (
            <>
              <div className="flex flex-row self-center">
                <InputOTP
                  maxLength={6}
                  required
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otp}
                  onChange={(e) => setOtp(e)}
                  autoFocus={true}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="w-full flex flex-col gap-2">
                <Button disabled={isOtpVerifyPending || !isOtpValid} onClick={handleVerifyOtp}>
                  {isOtpVerifyPending && <Loader />}
                  {!isOtpVerifyPending && 'Submit'}
                </Button>
                <Button
                  className="w-full"
                  disabled={isOtpRequestPending || !canRequestOtp}
                  onClick={() => {
                    if (canRequestOtp) {
                      handleRequestOtp()
                      toast.add({
                        description: 'Requested a new OTP.',
                        type: 'success',
                      })
                      return
                    } else {
                      toast.add({
                        description: 'Cannot request OTP yet.',
                        type: 'error',
                      })
                    }
                  }}
                >
                  {isOtpRequestPending && <Loader />}
                  {!isOtpRequestPending && 'Re-request OTP'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default OtpPage
