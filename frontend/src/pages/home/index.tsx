import { Center, Heading } from '@chakra-ui/react'
import { useNavigate } from 'react-router'

import { useAuthContext } from '@/context/auth'

const HomePage = () => {
  const navigate = useNavigate()

  const { user } = useAuthContext()

  if (!user.email) {
    navigate('login')
  }

  return (
    <Center w="100vw" h="100vh">
      <Heading>Full Stack Template</Heading>
    </Center>
  )
}

export default HomePage
