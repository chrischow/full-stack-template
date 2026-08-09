import { Button, Card, Center, Heading, Stack } from '@chakra-ui/react'
import { BiLogoGoogle } from 'react-icons/bi'

import { BACKEND_PREFIX } from '@/app/constants'

const LoginPage = () => {
  return (
    <Center w="100vw" h="100vh">
      <Card.Root colorPalette="indigo" variant="outline">
        <Card.Body>
          <Stack align="center" gap={6}>
            <Heading size="3xl">Full Stack Template</Heading>
            <Button
              w="full"
              colorPalette={'brand'}
              onClick={() => {
                window.location.href = `${BACKEND_PREFIX}/auth/oauth`
              }}
            >
              <BiLogoGoogle /> Login with Google
            </Button>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Center>
  )
}

export default LoginPage
