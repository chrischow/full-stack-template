import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'

import { IS_PUBLIC_KEY } from './public.decorator'

@Injectable()
export class CookieAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    // Allow access to public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request: Request = context.switchToHttp().getRequest()

    if (!request.session) {
      throw new InternalServerErrorException('Could not verify user.', {
        cause: {
          message: 'Session not found in request.',
          action: 'CookieAuthGuard',
        },
      })
    }

    // Expect an object of type SessionUser
    const user = request.session.user
    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication failed.', {
        cause: {
          message: 'Not authorised: User not found in session.',
          action: 'CookieAuthGuard',
        },
      })
    }
    return true
  }
}
