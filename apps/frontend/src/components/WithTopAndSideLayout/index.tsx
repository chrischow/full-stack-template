import { Avatar, AvatarGroup, Box, Button, HStack, Spacer, Stack, Text } from '@chakra-ui/react'
import { BiCog, BiHomeAlt, BiLogOut } from 'react-icons/bi'
import { Outlet, useNavigate } from 'react-router'

import { useAuthContext } from '@/context/auth'

import NavItem from './NavItem'

const WithTopAndSideLayout = () => {
  const navigate = useNavigate()

  const { user, logout } = useAuthContext()

  const navItems = [{ label: 'Home', to: '/', icon: <BiHomeAlt /> }]

  return (
    <Stack w="100vw" h="100vh" gap={0}>
      <HStack w="full" py={3} px={6} borderBottomWidth={1} borderBottomColor="border.emphasized">
        <Text>Your App Logo</Text>
        <Spacer />
        <AvatarGroup>
          <Avatar.Root>
            <Avatar.Fallback name={user.name} />
          </Avatar.Root>
        </AvatarGroup>
      </HStack>
      <HStack w="full" h="full" gap={0}>
        {/* Sidebar */}
        <Stack h="full" w="300px" p={6} borderRightWidth={1} borderRightColor="border.emphasized">
          {navItems.map((navItem) => (
            <NavItem key={`nav-item-${navItem.label}`} {...navItem} />
          ))}
          <Spacer />
          <Button variant="subtle" justifyContent="start" onClick={() => navigate('/account')}>
            <BiCog /> Account Settings
          </Button>
          <Button
            variant="ghost"
            colorPalette="red"
            justifyContent="start"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <BiLogOut /> Logout
          </Button>
        </Stack>
        <Box w="full" h="full" px={6} py={4}>
          <Outlet />
        </Box>
      </HStack>
    </Stack>
  )
}

export default WithTopAndSideLayout
