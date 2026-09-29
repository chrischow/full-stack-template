import { EmailLoginInputsSchema, OtpResponseSchema } from '@repo/api-contract/schemas'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { ArrowLeft, Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import AuthShell from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { toast } from '@/components/ui/toast'
import { useAuthContext } from '@/context/auth'
import { useOtp } from '@/hooks'

const OtpPage = () => {
  const navigate = useNavigate()
  const { login } = useAuthContext()
  const { generateOtp, isGeneratingOtp, verifyOtp, isVerifyingOtp } = useOtp()

  const [isOtpRequested, setIsOtpRequested] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const [canRequestAfter, setCanRequestAfter] = useState<Date>()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!canRequestAfter || Date.now() >= canRequestAfter.getTime()) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [canRequestAfter])

  const handleRequestOtp = async () => {
    const { success } = EmailLoginInputsSchema.safeParse({ email })
    if (!success) {
      setError('Please enter a valid email address.')
      return
    }
    setError(undefined)
    setOtp('')
    await generateOtp(
      { email },
      {
        onSuccess: (response) => {
          const parsed = OtpResponseSchema.safeParse(response)
          if (!parsed.success) {
            toast.add({
              description: 'Failed to generate OTP.',
              type: 'error',
            })
            return
          }
          setCanRequestAfter(parsed.data.canRequestAfter)
          setIsOtpRequested(true)
        },
      },
    )
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return
    await verifyOtp(
      { email, otp },
      {
        onSuccess: (user) => {
          login(user)
          navigate('/')
        },
        onError: () => {
          setOtp('')
        },
      },
    )
  }

  const resendCooldownSeconds = canRequestAfter ? Math.max(0, Math.ceil((canRequestAfter.getTime() - now) / 1000)) : 0
  const isOtpValid = otp.length === 6

  return (
    <AuthShell>
      <Card className="rounded-2xl shadow-lg shadow-primary/5 ring-border">
        {!isOtpRequested ? (
          <>
            <CardHeader>
              <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => navigate('..')}>
                <ArrowLeft /> Back to sign in
              </Button>
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Enter your email</h1>
                <p className="text-sm text-muted-foreground">We&apos;ll email you a one-time code to sign in.</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11"
                  value={email}
                  aria-invalid={error ? true : undefined}
                  autoFocus
                  onChange={(e) => {
                    setEmail(e.currentTarget.value)
                    if (error) setError(undefined)
                  }}
                  onKeyDown={(e) => {
                    if (e.code === 'Enter') {
                      void handleRequestOtp()
                    }
                  }}
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <Button
                size="lg"
                className="mt-4 h-11 w-full"
                disabled={isGeneratingOtp}
                onClick={() => void handleRequestOtp()}
              >
                {isGeneratingOtp && <Loader className="animate-spin" />}
                Continue
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => setIsOtpRequested(false)}>
                <ArrowLeft /> Back to email
              </Button>
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Check your inbox</h1>
                <p className="text-sm text-muted-foreground">A 6-digit code was sent to {email}.</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center py-2">
                <InputOTP
                  maxLength={6}
                  required
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otp}
                  onChange={(e) => setOtp(e)}
                  autoFocus
                >
                  <InputOTPGroup className="gap-0 rounded-2xl">
                    <InputOTPSlot index={0} className="size-12 rounded-l-2xl" />
                    <InputOTPSlot index={1} className="size-12" />
                    <InputOTPSlot index={2} className="size-12" />
                    <InputOTPSlot index={3} className="size-12" />
                    <InputOTPSlot index={4} className="size-12" />
                    <InputOTPSlot index={5} className="size-12 rounded-r-2xl" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                size="lg"
                className="mt-4 h-11 w-full"
                disabled={isVerifyingOtp || !isOtpValid}
                onClick={() => void handleVerifyOtp()}
              >
                {isVerifyingOtp && <Loader className="animate-spin" />}
                Verify
              </Button>
              <div className="flex justify-center pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit text-muted-foreground hover:text-foreground"
                  disabled={resendCooldownSeconds > 0 || isGeneratingOtp}
                  onClick={() => void handleRequestOtp()}
                >
                  {resendCooldownSeconds > 0 ? `Resend code in ${resendCooldownSeconds}s` : 'Resend code'}
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </AuthShell>
  )
}

export default OtpPage
