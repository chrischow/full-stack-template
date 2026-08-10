import { Center, HStack, Spinner, Text } from '@chakra-ui/react'
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
    <Center w="100vw" h="100vh">
      <HStack gap={2}>
        <Spinner />
        <Text>Loading</Text>
      </HStack>
    </Center>
  )
}

export default LoginRedirectPage
