import { Loader } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { useAuthContext } from '@/context/auth'
import { useAuth } from '@/hooks'

const LoginRedirectPage = () => {
  const navigate = useNavigate()

  const { login } = useAuthContext()
  const { getUser } = useAuth()

  useEffect(() => {
    const loginUser = async () => {
      const user = await getUser({})
      login(user)
      navigate('/')
    }

    loginUser()
  }, [getUser, login, navigate])

  return (
    <div className="w-dvw h-dvh flex flex-row justify-center content-center">
      <div className="flex flew-row">
        <Loader /> Loading
      </div>
    </div>
  )
}

export default LoginRedirectPage
