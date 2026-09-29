import { BiLogoGoogle } from 'react-icons/bi'
import { HiOutlineMail } from 'react-icons/hi'
import { useNavigate } from 'react-router'

import { BACKEND_PREFIX } from '@/app/constants'
import AuthShell from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

import PasskeyLoginButton from './PasskeyLoginButton'

const LoginPage = () => {
  const navigate = useNavigate()

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
              onClick={() => {
                window.location.href = `${BACKEND_PREFIX}/auth/oauth`
              }}
            >
              <BiLogoGoogle />
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
              onClick={() => {
                navigate('otp')
              }}
            >
              <HiOutlineMail />
              Continue with Email
            </Button>
            <PasskeyLoginButton />
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
