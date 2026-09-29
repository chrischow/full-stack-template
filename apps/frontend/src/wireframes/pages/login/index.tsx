import { Loader } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BiLogoGoogle } from 'react-icons/bi'
import { HiOutlineMail } from 'react-icons/hi'
import { IoMdFingerPrint } from 'react-icons/io'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import AuthShell from '@/wireframes/components/AuthShell'

type LoginMethod = 'google' | 'email' | 'passkey'

const MOCK_DELAY_MS = 900

const LoginPage = () => {
  const navigate = useNavigate()
  const [pendingMethod, setPendingMethod] = useState<LoginMethod | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleMockLogin = (method: LoginMethod, destination: string) => {
    if (pendingMethod) return
    setPendingMethod(method)
    timeoutRef.current = setTimeout(() => {
      navigate(destination)
    }, MOCK_DELAY_MS)
  }

  const isPending = pendingMethod !== null

  return (
    <AuthShell>
      <Card className="rounded-2xl shadow-lg shadow-primary/5 ring-border">
        <CardHeader>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in with one of the options below.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-11 w-full bg-white"
              disabled={isPending}
              onClick={() => handleMockLogin('google', '/wireframes')}
            >
              {pendingMethod === 'google' ? <Loader className="animate-spin" /> : <BiLogoGoogle />}
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or continue with</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              size="lg"
              className="h-11 w-full"
              disabled={isPending}
              onClick={() => handleMockLogin('email', 'email')}
            >
              {pendingMethod === 'email' ? <Loader className="animate-spin" /> : <HiOutlineMail />}
              Continue with Email
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="h-11 w-full"
              disabled={isPending}
              onClick={() => handleMockLogin('passkey', '/wireframes')}
            >
              {pendingMethod === 'passkey' ? <Loader className="animate-spin" /> : <IoMdFingerPrint />}
              Continue with Passkey
            </Button>
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-6 text-xs text-muted-foreground">
            <span>By continuing, you agree to our</span>
            <span className="cursor-pointer text-foreground underline underline-offset-2 hover:text-primary">
              Terms
            </span>
            <span>and</span>
            <span className="cursor-pointer text-foreground underline underline-offset-2 hover:text-primary">
              Privacy Policy
            </span>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  )
}

export default LoginPage
