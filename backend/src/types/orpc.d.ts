import { type Request } from 'express'

declare module '@orpc/nest' {
  interface ORPCGlobalContext {
    request: Request
  }
}
