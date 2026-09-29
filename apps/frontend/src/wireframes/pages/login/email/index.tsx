import { EmailLoginInputsSchema } from '@repo/api-contract/schemas'
import { ArrowLeft, Loader } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import AuthShell from '@/wireframes/components/AuthShell'

const MOCK_DELAY_MS = 700

const EmailPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string>()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleContinue = () => {
    if (isPending) return
    const { success } = EmailLoginInputsSchema.safeParse({ email })
    if (!success) {
      setError('Please enter a valid email address.')
      return
    }
    setError(undefined)
    setIsPending(true)
    timeoutRef.current = setTimeout(() => {
      navigate('../otp', { relative: 'path' })
    }, MOCK_DELAY_MS)
  }

  return (
    <AuthShell>
      <Card className="rounded-2xl shadow-lg shadow-primary/5 ring-border">
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
                  handleContinue()
                }
              }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button size="lg" className="mt-4 h-11 w-full" disabled={isPending} onClick={handleContinue}>
            {isPending && <Loader className="animate-spin" />}
            Continue
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  )
}

export default EmailPage
