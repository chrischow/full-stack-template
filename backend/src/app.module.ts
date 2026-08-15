import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { REQUEST } from '@nestjs/core'
import { onError, ORPCError, ORPCModule } from '@orpc/nest'
import { experimental_RethrowHandlerPlugin as RethrowHandlerPlugin } from '@orpc/server/plugins'
import { Request } from 'express'
import { LoggerModule } from 'nestjs-pino'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { validate } from './env/schema'
import { HealthModule } from './health/health.module'
import { pinoHttp } from './logger'
import { MailModule } from './mail/mail.module'
import { HelmetMiddleware } from './middleware/helmet.middleware'
import { SessionMiddleware } from './middleware/session.middleware'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    HealthModule,
    LoggerModule.forRoot({ pinoHttp }),
    ORPCModule.forRootAsync({
      useFactory: (request: Request) => ({
        interceptors: [
          onError((error) => {
            console.error(error)
          }),
        ],
        context: { request },
        eventIteratorKeepAliveInterval: 5000,
        customJsonSerializers: [],
        plugins: [
          new RethrowHandlerPlugin({
            filter: (error) => {
              // Rethrow non-ORPCError errors to bubble up to NestJS global exception filters
              return !(error instanceof ORPCError)
            },
          }),
        ],
      }),
      inject: [REQUEST],
    }),
    PrismaModule,
    AuthModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HelmetMiddleware, SessionMiddleware).forRoutes('{*path}')
  }
}
