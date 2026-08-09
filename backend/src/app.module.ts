import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { validate } from './env/schema'
import { HealthModule } from './health/health.module'
import { pinoHttp } from './logger'
import { HelmetMiddleware } from './middleware/helmet.middleware'
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
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    AppService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HelmetMiddleware).forRoutes('{*path}')
  }
}
