import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { validate } from './env/schema'
import { HealthModule } from './health/health.module'
import { pinoHttp } from './logger'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    HealthModule,
    LoggerModule.forRoot({ pinoHttp }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
