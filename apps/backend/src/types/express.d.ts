import { SessionUser } from '@repo/api-contract/schemas'
import type { Session, SessionData } from 'express-session'

declare module 'express' {
  export interface Request {
    session: Session & Partial<SessionData> & { user: SessionUser }
  }
  export interface Response {
    err?: any
  }
}

export {}
