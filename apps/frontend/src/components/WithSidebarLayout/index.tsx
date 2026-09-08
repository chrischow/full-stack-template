import { BiCog, BiHomeAlt, BiLogOut } from 'react-icons/bi'
import { Link, Outlet, useNavigate } from 'react-router'

import { useAuthContext } from '@/context/auth'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '../ui/sidebar'

const WithSidebarLayout = () => {
  const navigate = useNavigate()

  const { logout } = useAuthContext()

  const navItems = [{ label: 'Home', to: '/', icon: BiHomeAlt }]

  return (
    <div className="w-dvw h-dvh gap-0">
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader className="px-2">
            <h3 className="text-lg font-semibold">Full Stack Template</h3>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((navItem) => (
                    <SidebarMenuItem key={`nav-item-${navItem.label}`}>
                      <SidebarMenuButton render={<Link to={navItem.to} />}>
                        <navItem.icon />
                        <span>{navItem.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link to={'/account'} />}>
                <BiCog />
                <span>Account Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
              >
                <BiLogOut className="text-destructive" />
                <span className="text-destructive">Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

export default WithSidebarLayout
