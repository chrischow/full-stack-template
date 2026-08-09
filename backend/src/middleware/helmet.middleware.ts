import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import helmet from 'helmet'

@Injectable()
export class HelmetMiddleware implements NestMiddleware {
  private middleware: RequestHandler

  constructor() {
    this.middleware = helmet({
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  }

  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('Cache-control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0')
    res.setHeader('Expires', '0')
    this.middleware(req, res, next)
  }
}
