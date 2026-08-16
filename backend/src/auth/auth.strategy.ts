import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Profile, Strategy, VerifyCallback } from 'passport-openidconnect'

import { env } from '@/env/schema'
import { SessionUserSchema } from '@/shared/schemas'
import { UserService } from '@/user/user.service'

@Injectable()
export class OAuthStrategy extends PassportStrategy(Strategy, 'oauth') {
  constructor(private readonly userService: UserService) {
    super({
      issuer: `${env.OAUTH_BASE_URL}`,
      authorizationURL: `${env.OAUTH_BASE_URL}/auth`,
      tokenURL: `${env.OAUTH_BASE_URL}/token`,
      userInfoURL: `${env.OAUTH_BASE_URL}/userinfo`,
      clientID: env.OAUTH_CLIENT_ID,
      clientSecret: env.OAUTH_CLIENT_SECRET,
      callbackURL: env.OAUTH_CLIENT_CALLBACK_URL,
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
