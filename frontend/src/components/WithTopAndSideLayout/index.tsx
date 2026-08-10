import { Avatar, AvatarGroup, Box, HStack, Spacer, Stack, Text } from '@chakra-ui/react'
import { BiCog, BiHomeAlt } from 'react-icons/bi'
import { Outlet } from 'react-router'

import { useAuthContext } from '@/context/auth'

import NavItem from './NavItem'

const WithTopAndSideLayout = () => {
  const { user } = useAuthContext()

  const navItems = [
    { label: 'Home', to: '/', icon: <BiHomeAlt /> },
    { label: 'Settings', to: '/settings', icon: <BiCog /> },
  ]

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
        </Stack>
        <Box w="full" h="full" px={6} py={4}>
          <Outlet />
        </Box>
      </HStack>
    </Stack>
  )
}

export default WithTopAndSideLayout
