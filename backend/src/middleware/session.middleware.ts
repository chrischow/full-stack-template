import { Injectable, NestMiddleware } from '@nestjs/common'
import { PrismaSessionStore } from '@quixo3/prisma-session-store'
import { NextFunction, Request, Response } from 'express'
import session from 'express-session'

import { env } from '@/env/schema'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const sessionMiddleware = session({
      cookie: {
        maxAge: env.SESSION_COOKIE_MAX_AGE,
        httpOnly: true,
        signed: true,
        secure: ['production', 'staging'].includes(env.NODE_ENV),
        sameSite: 'strict',
      },
      name: env.SESSION_NAME,
      secret: env.SESSION_SECRET,
      resave: true,
      saveUninitialized: false,
      store: new PrismaSessionStore(this.prisma, {
        checkPeriod: 2 * 60 * 1000,
        dbRecordIdIsSessionId: true,
        dbRecordIdFunction: undefined,
      }),
    })

    sessionMiddleware(req, res, next)
  }
}
