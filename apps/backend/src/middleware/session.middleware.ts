import { Injectable, NestMiddleware } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaSessionStore } from '@quixo3/prisma-session-store'
import { NextFunction, Request, Response } from 'express'
import session from 'express-session'

import { Env } from '@/env/schema'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const sessionMiddleware = session({
      cookie: {
        maxAge: this.config.get('SESSION_COOKIE_MAX_AGE', { infer: true }),
        httpOnly: true,
        signed: true,
        secure: ['production', 'staging'].includes(this.config.get('NODE_ENV', { infer: true })),
        sameSite: 'strict',
      },
      name: this.config.get('SESSION_NAME', { infer: true }),
      secret: this.config.get('SESSION_SECRET', { infer: true }),
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
