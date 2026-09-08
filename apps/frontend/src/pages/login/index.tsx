import { BiLogoGoogle } from 'react-icons/bi'
import { HiOutlineMail } from 'react-icons/hi'
import { useNavigate } from 'react-router'

import { BACKEND_PREFIX } from '@/app/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import PasskeyLoginButton from './PasskeyLoginButton'

const LoginPage = () => {
  const navigate = useNavigate()

  return (
    <div className="w-dvw h-dvh flex flex-col justify-center content-center">
      <Card className="w-md self-center">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold">Full Stack Template</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => {
              window.location.href = `${BACKEND_PREFIX}/auth/oauth`
            }}
          >
            <BiLogoGoogle /> Login with Google
          </Button>
          <Button
            className="w-full"
            onClick={async () => {
              navigate('otp')
            }}
          >
            <HiOutlineMail /> Request an OTP
          </Button>
          <PasskeyLoginButton />
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginPage
