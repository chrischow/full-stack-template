import type { Session, SessionData } from 'express-session'

import { SessionUser } from '@/shared/schemas'

declare module 'express' {
  export interface Request {
    session: Session & Partial<SessionData> & { user: SessionUser }
  }
  export interface Response {
    err?: any
  }
}

export {}
