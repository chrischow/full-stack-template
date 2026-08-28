import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { PassportModule } from '@nestjs/passport'

import { AppCacheModule } from '@/app_cache/app_cache.module'
import { MailModule } from '@/mail/mail.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { UserModule } from '@/user/user.module'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OAuthStrategy } from './auth.strategy'
import { CookieAuthGuard } from './cookie-auth.guard'
import { OtpService } from './otp.service'
import { PasskeyService } from './passkey.service'

@Module({
  imports: [PassportModule.register({ session: true }), PrismaModule, MailModule, AppCacheModule, UserModule],
  controllers: [AuthController],
  providers: [
    OAuthStrategy,
    { provide: APP_GUARD, useClass: CookieAuthGuard },
    AuthService,
    OtpService,
    PasskeyService,
  ],
})
export class AuthModule {}
