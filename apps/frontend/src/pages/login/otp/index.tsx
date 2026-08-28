import { Button, Card, Center, Field, Heading, Input, PinInput, Stack, Text } from '@chakra-ui/react'
import { ORPCError } from '@orpc/client'
import { EmailLoginInputsSchema, OtpResponseSchema } from '@repo/api-contract/schemas'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { orpc } from '@/app/orpc-client'
import { toaster } from '@/components/ui/toaster'
import { useAuthContext } from '@/context/auth'

const OtpPage = () => {
  const navigate = useNavigate()
  const { login } = useAuthContext()

  const [isOtpRequested, setIsOtpRequested] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', ''])
  const [canRequestAfter, setCanRequestAfter] = useState<Date>()

  const { mutateAsync: requestOtp, isPending: isOtpRequestPending } = useMutation(
    orpc.auth.otp.generate.mutationOptions({
      onSuccess: (response) => {
        const { success, data } = OtpResponseSchema.safeParse(response)
        if (!success) {
          toaster.create({
            description: <Text color="fg.error">Failed to generate OTP.</Text>,
            duration: 3000,
          })
          return
        }
        setCanRequestAfter(data.canRequestAfter)
        setIsOtpRequested(true)
      },
    }),
  )

  const { mutateAsync: verifyOtp, isPending: isOtpVerifyPending } = useMutation(
    orpc.auth.otp.verify.mutationOptions({
      onSuccess: (user) => {
        toaster.create({
          description: <Text color="fg.success">Logged in successfully.</Text>,
          duration: 3000,
        })

        login(user)

        navigate('/')
      },
      onError: (error) => {
        setOtp(['', '', '', '', '', ''])
        if (error instanceof ORPCError) {
          toaster.create({
            description: <Text color="fg.error">{error.data.body.message}</Text>,
            duration: 3000,
          })
          return
        }
        toaster.create({
          description: <Text color="fg.error">Failed to validate OTP. Please try again.</Text>,
          duration: 3000,
        })
      },
    }),
  )

  const handleRequestOtp = async () => {
    const { success } = EmailLoginInputsSchema.safeParse({ email })
    if (!success) {
      toaster.create({
        description: <Text color="fg.error">Please input a valid email.</Text>,
        duration: 3000,
      })
      return
    }
    setOtp(['', '', '', '', '', ''])
    await requestOtp({ email })
  }

  const handleVerifyOtp = async () => {
    const fullOtp = otp.join('')
    if (fullOtp.length !== 6) {
      toaster.create({
        description: <Text color="fg.error">Invalid OTP.</Text>,
        duration: 3000,
      })
    }
    await verifyOtp({ email, otp: fullOtp })
  }

  const canRequestOtp = canRequestAfter ? new Date().getTime() >= canRequestAfter.getTime() : false
  const fullOtp = otp.join('')
  const isOtpValid = fullOtp.length === 6

  return (
    <Center w="100vw" h="100vh">
      <Card.Root colorPalette="indigo" variant="outline">
        <Card.Body>
          <Stack align="center" gap={6}>
            <Heading size="3xl">Full Stack Template</Heading>
            <Stack w="100%" gap={4}>
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
                  <Button w="full" colorPalette={'brand'} loading={isOtpRequestPending} onClick={handleRequestOtp}>
                    Request OTP
                  </Button>
                </>
              )}
              {isOtpRequested && (
                <>
                  <Field.Root gap={3}>
                    <Field.Label>Enter your OTP:</Field.Label>
                    <PinInput.Root otp value={otp} onValueChange={(e) => setOtp(e.value)} autoFocus={true}>
                      <PinInput.HiddenInput />
                      <PinInput.Control>
                        <PinInput.Input index={0} />
                        <PinInput.Input index={1} />
                        <PinInput.Input index={2} />
                        <PinInput.Input index={3} />
                        <PinInput.Input index={4} />
                        <PinInput.Input index={5} />
                      </PinInput.Control>
                    </PinInput.Root>
                  </Field.Root>
                  <Stack w="100%">
                    <Button
                      colorPalette="brand"
                      loading={isOtpVerifyPending}
                      disabled={!isOtpValid}
                      onClick={handleVerifyOtp}
                    >
                      Submit
                    </Button>
                    <Button
                      w="100%"
                      colorPalette="gray"
                      variant="subtle"
                      disabled={!canRequestOtp}
                      loading={isOtpRequestPending}
                      onClick={() => {
                        if (canRequestOtp) {
                          handleRequestOtp()
                          toaster.create({
                            description: <Text color="fg.success">Requested a new OTP.</Text>,
                            duration: 3000,
                          })
                          return
                        } else {
                          toaster.create({
                            description: <Text color="fg.error">Cannot request OTP yet.</Text>,
                            duration: 3000,
                          })
                        }
                      }}
                    >
                      Re-request OTP
                    </Button>
                  </Stack>
                </>
              )}
            </Stack>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Center>
  )
}

export default OtpPage
