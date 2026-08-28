import type { SessionUser } from '~shared/schemas'

export interface AuthContextProps {
  user: SessionUser
  login: (user: SessionUser) => void
  logout: () => void
}
