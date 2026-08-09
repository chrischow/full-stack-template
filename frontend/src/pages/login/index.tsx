import { Button, Center, Heading, Stack } from '@chakra-ui/react'

import { BACKEND_PREFIX } from '@/app/constants'

const LoginPage = () => {
  return (
    <Center w="100vw" h="100vh">
      <Stack align="center" gap={4}>
        <Heading size="4xl">Full Stack Template</Heading>
        <Button
          colorPalette={'purple'}
          onClick={() => {
            window.location.href = `${BACKEND_PREFIX}/auth/oauth`
          }}
        >
          Login
        </Button>
      </Stack>
    </Center>
  )
}

export default LoginPage
