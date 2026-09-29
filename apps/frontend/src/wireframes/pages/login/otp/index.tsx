import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { ArrowLeft, Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { toast } from '@/components/ui/toast'
import AuthShell from '@/wireframes/components/AuthShell'

const RESEND_COOLDOWN_SECONDS = 30

const OtpPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const mockEmail = (location.state as { email?: string } | null)?.email

  const [otp, setOtp] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const isOtpValid = otp.length === 6

  const handleVerify = () => {
    if (isPending || !isOtpValid) return
    setIsPending(true)
    setTimeout(() => {
      navigate('/wireframes')
    }, 900)
  }

  const handleResend = () => {
    setOtp('')
    setCooldown(RESEND_COOLDOWN_SECONDS)
    toast.add({
      description: mockEmail ? `A new code was sent to ${mockEmail}.` : 'A new code was sent to your email.',
      type: 'success',
    })
  }

  return (
    <AuthShell>
      <Card className="rounded-2xl shadow-lg shadow-primary/5 ring-border">
        <CardHeader>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit"
            onClick={() => navigate('../email', { state: mockEmail ? { email: mockEmail } : undefined })}
          >
            <ArrowLeft /> Back to email
          </Button>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">
              {mockEmail
                ? `A 6-digit code was sent to ${mockEmail}.`
                : 'We sent a 6-digit code to your email. Enter it below to sign in.'}
            </p>
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
          <Button size="lg" className="mt-4 h-11 w-full" disabled={isPending || !isOtpValid} onClick={handleVerify}>
            {isPending && <Loader className="animate-spin" />}
            Verify
          </Button>
          <div className="flex justify-center pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit text-muted-foreground hover:text-foreground"
              disabled={cooldown > 0}
              onClick={handleResend}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}

export default OtpPage
