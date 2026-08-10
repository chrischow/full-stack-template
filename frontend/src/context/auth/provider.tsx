import { type ReactNode, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useLocalStorage } from 'usehooks-ts'

import { useAuthStatus, useLogout } from '@/hooks'
import type { SessionUser } from '~shared/schemas'

import { AuthContext } from './context'

const EMPTY_USER = { id: '', name: '', email: '' }

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const [user, setUser] = useLocalStorage('USER', EMPTY_USER)
  const { getAuthStatus } = useAuthStatus()
  const { logoutUser } = useLogout()

  useEffect(() => {
    const checkAuthStatus = async () => {
      const authStatus = await getAuthStatus({})
      if (!authStatus) {
        navigate('/login')
      }
    }

    if (location.pathname !== '/login') {
      checkAuthStatus()
    }
  }, [getAuthStatus, navigate, location])

  const login = (user: SessionUser) => {
    setUser(user)
  }

  const logout = async () => {
    await logoutUser({})
    setUser(EMPTY_USER)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}
