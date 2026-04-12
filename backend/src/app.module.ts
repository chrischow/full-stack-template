import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { validate } from './env/schema'
import { HealthModule } from './health/health.module'
import { pinoHttp } from './logger'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    HealthModule,
    LoggerModule.forRoot({ pinoHttp }),
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
