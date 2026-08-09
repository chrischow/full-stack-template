import { createContext, useContext } from 'react'

import type { AuthContextProps } from './types'

export const AuthContext = createContext<AuthContextProps>({
  user: {
    id: '',
    name: '',
    email: '',
  },
  login: () => undefined,
  logout: () => undefined,
})

export const useAuthContext = () => {
  return useContext(AuthContext)
}
