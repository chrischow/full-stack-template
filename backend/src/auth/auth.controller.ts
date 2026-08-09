import { Controller, UnauthorizedException, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Implement, implement } from '@orpc/nest'

import { env } from '@/env/schema'
import { contract } from '@/shared/contracts'
import { SessionUserSchema } from '@/shared/schemas'

import { Public } from './public.decorator'

@Controller()
export class AuthController {
  @Public()
  @Implement(contract.auth.status)
  status() {
    return implement(contract.auth.status).handler(({ context }) => {
      return !!context.request.session.user
    })
  }

  @Implement(contract.auth.userinfo)
  userinfo() {
    return implement(contract.auth.userinfo).handler(({ context }) => {
      const { user } = context.request.session

      return user
    })
  }

  @Public()
  @UseGuards(AuthGuard('oauth'))
  @Implement(contract.auth.oauth)
  oauthGoogle() {
    return implement(contract.auth.oauth).handler(() => {})
  }

  @Public()
  @UseGuards(AuthGuard('oauth'))
  @Implement(contract.auth.oauthRedirect)
  oauthGoogleRedirect() {
    return implement(contract.auth.oauthRedirect).handler(({ context }) => {
      const { user } = context.request

      if (!user) {
        throw new UnauthorizedException('Not auathorised.')
      }

      context.request.session.user = SessionUserSchema.parse(user)
      return {
        headers: {
          location: `${env.APP_DOMAIN}/login/redirect`,
        },
      }
    })
  }
}
