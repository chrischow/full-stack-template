import { useNavigate } from 'react-router'

import { useAuthContext } from '@/context/auth'

const HomePage = () => {
  const navigate = useNavigate()

  const { user } = useAuthContext()

  if (!user.email) {
    navigate('login')
  }

  return (
    <div className="w-full h-dvh flex flex-col justify-center content-center text-center">
      <h1 className="text-4xl font-bold">Full Stack Template</h1>
    </div>
  )
}

export default HomePage
