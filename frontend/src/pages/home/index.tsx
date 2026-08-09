import { Box, Heading } from '@chakra-ui/react'
import { useNavigate } from 'react-router'

import { useAuthContext } from '@/context/auth'

const HomePage = () => {
  const navigate = useNavigate()

  const { user } = useAuthContext()

  if (!user.email) {
    navigate('login')
  }

  return (
    <Box>
      <Heading>Full Stack Template</Heading>
    </Box>
  )
}

export default HomePage
