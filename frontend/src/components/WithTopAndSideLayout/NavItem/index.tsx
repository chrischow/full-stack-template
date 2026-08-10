import { Button } from '@chakra-ui/react'
import type { ReactElement } from 'react'
import { Link, useLocation } from 'react-router'

const NavItem = ({ label, to, icon }: { label: string; to: string; icon: ReactElement }) => {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Button
      variant="subtle"
      colorPalette="gray"
      color={isActive ? 'brand.contrast' : undefined}
      bg={isActive ? 'brand.solid' : undefined}
      _hover={{
        bg: isActive ? undefined : 'brand.solid',
      }}
      asChild
      justifyContent="start"
    >
      <Link to={to}>
        {icon} {label}
      </Link>
    </Button>
  )
}

export default NavItem
