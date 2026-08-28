import type { SessionUser } from '@repo/api-contract/schemas'

export interface AuthContextProps {
  user: SessionUser
  login: (user: SessionUser) => void
  logout: () => void
}
