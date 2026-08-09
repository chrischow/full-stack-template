import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { PassportModule } from '@nestjs/passport'

import { PrismaModule } from '@/prisma/prisma.module'

import { AuthController } from './auth.controller'
import { OAuthStrategy } from './auth.strategy'
import { CookieAuthGuard } from './cookie-auth.guard'

@Module({
  imports: [PassportModule.register({ session: true }), PrismaModule],
  controllers: [AuthController],
  providers: [OAuthStrategy, { provide: APP_GUARD, useClass: CookieAuthGuard }],
})
export class AuthModule {}
