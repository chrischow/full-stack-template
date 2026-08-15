import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { PassportModule } from '@nestjs/passport'

import { MailModule } from '@/mail/mail.module'
import { PrismaModule } from '@/prisma/prisma.module'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OAuthStrategy } from './auth.strategy'
import { CookieAuthGuard } from './cookie-auth.guard'

@Module({
  imports: [PassportModule.register({ session: true }), PrismaModule, MailModule],
  controllers: [AuthController],
  providers: [OAuthStrategy, { provide: APP_GUARD, useClass: CookieAuthGuard }, AuthService],
})
export class AuthModule {}
