import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { SessionUserSchema } from '@repo/api-contract/schemas'
import { Profile, Strategy, VerifyCallback } from 'passport-openidconnect'

import { Env } from '@/env/schema'
import { UserService } from '@/user/user.service'

@Injectable()
export class OAuthStrategy extends PassportStrategy(Strategy, 'oauth') {
  constructor(
    private readonly userService: UserService,
    config: ConfigService<Env, true>,
  ) {
    super({
      issuer: `${config.get('OAUTH_BASE_URL', { infer: true })}`,
      authorizationURL: `${config.get('OAUTH_BASE_URL', { infer: true })}/auth`,
      tokenURL: `${config.get('OAUTH_BASE_URL', { infer: true })}/token`,
      userInfoURL: `${config.get('OAUTH_BASE_URL', { infer: true })}/userinfo`,
      clientID: config.get('OAUTH_CLIENT_ID', { infer: true }),
      clientSecret: config.get('OAUTH_CLIENT_SECRET', { infer: true }),
      callbackURL: config.get('OAUTH_CLIENT_CALLBACK_URL', { infer: true }),
      skipUserProfile: false,
      scope: ['openid', 'email', 'profile'],
    })
  }

  async validate(_issuer: string, profile: Profile, done: VerifyCallback) {
    const { emails } = profile

    if (!emails || emails.length === 0) {
      return done(new UnauthorizedException('No emails to authorise.'), undefined)
    }

    const email = emails[0].value as string

    if (!email) {
      return done(new UnauthorizedException('No emails to authorise.'), undefined)
    }

    const user = await this.userService.findUserByEmail({ email })

    if (!user) {
      return done(
        new UnauthorizedException('User not authorised.', {
          cause: {
            message: `User does not exist.`,
            action: 'OAuthStrategy',
            meta: {
              email,
            },
          },
        }),
        undefined,
      )
    }

    const { success, data: validatedUser } = SessionUserSchema.safeParse(user)
    if (!success) {
      throw new InternalServerErrorException('Could not verify user.', {
        cause: {
          email,
        },
      })
    }

    return done(null, validatedUser)
  }
}
