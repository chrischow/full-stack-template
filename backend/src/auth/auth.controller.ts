import { Controller, UnauthorizedException, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Implement, implement } from '@orpc/nest'

import { env } from '@/env/schema'
import { contract } from '@/shared/contracts'
import { SessionUserSchema } from '@/shared/schemas'

import { AuthService } from './auth.service'
import { Public } from './public.decorator'

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}
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
  @Implement(contract.auth.oauth.login)
  oauthGoogle() {
    return implement(contract.auth.oauth.login).handler(() => {})
  }

  @Public()
  @UseGuards(AuthGuard('oauth'))
  @Implement(contract.auth.oauth.redirect)
  oauthGoogleRedirect() {
    return implement(contract.auth.oauth.redirect).handler(({ context }) => {
      const { user } = context.request

      if (!user) {
        throw new UnauthorizedException('Not authorised.')
      }

      context.request.session.user = SessionUserSchema.parse(user)
      return {
        headers: {
          location: `${env.APP_DOMAIN}/login/redirect`,
        },
      }
    })
  }

  @Implement(contract.auth.logout)
  logout() {
    return implement(contract.auth.logout).handler(({ context }) => {
      const { session } = context.request
      return session.destroy(() => {
        return
      })
    })
  }

  @Public()
  @Implement(contract.auth.otp.generate)
  generateOtp() {
    return implement(contract.auth.otp.generate).handler(async ({ input }) => {
      const { email } = input
      return await this.authService.requestOtp({ email })
    })
  }

  @Public()
  @Implement(contract.auth.otp.verify)
  verifyOtp() {
    return implement(contract.auth.otp.verify).handler(async ({ input, context }) => {
      const user = await this.authService.verifyOtp(input)
      context.request.session.user = user
      return user
    })
  }

  @Implement(contract.auth.passkeys.register.start)
  registerPasskey() {
    return implement(contract.auth.passkeys.register.start).handler(async ({ context }) => {
      const { user } = context.request.session
      return await this.authService.generatePasskeyRegistrationOptions({ user })
    })
  }

  @Implement(contract.auth.passkeys.register.verify)
  verifyPasskeyRegistration() {
    return implement(contract.auth.passkeys.register.verify).handler(async ({ context, input }) => {
      const { user } = context.request.session
      return await this.authService.verifyPasskeyRegistration({ user, credentials: input })
    })
  }

  @Public()
  @Implement(contract.auth.passkeys.login.start)
  passkeyLogin() {
    return implement(contract.auth.passkeys.login.start).handler(async () => {
      return await this.authService.generatePasskeyLoginOptions()
    })
  }

  @Public()
  @Implement(contract.auth.passkeys.login.verify)
  verifyPasskeyLogin() {
    return implement(contract.auth.passkeys.login.verify).handler(async ({ context, input }) => {
      const user = await this.authService.verifyPasskeyLogin(input)
      context.request.session.user = user
      return user
    })
  }

  @Implement(contract.auth.passkeys.list)
  listPasskeys() {
    return implement(contract.auth.passkeys.list).handler(async ({ context }) => {
      const { user } = context.request.session
      return await this.authService.listPasskeys({ user })
    })
  }

  @Implement(contract.auth.passkeys.revoke)
  revokePasskey() {
    return implement(contract.auth.passkeys.revoke).handler(async ({ context, input }) => {
      const { user } = context.request.session
      const { passkeyId } = input
      return await this.authService.revokePasskey({ user, passkeyId })
    })
  }
}
