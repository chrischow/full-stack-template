import { KeyvPostgres } from '@keyv/postgres'
import { CacheModule } from '@nestjs/cache-manager'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { REQUEST } from '@nestjs/core'
import { onError, ORPCError, ORPCModule } from '@orpc/nest'
import { experimental_RethrowHandlerPlugin as RethrowHandlerPlugin } from '@orpc/server/plugins'
import { Request } from 'express'
import { LoggerModule } from 'nestjs-pino'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AppCacheModule } from './app_cache/app_cache.module'
import { AuthModule } from './auth/auth.module'
import { env, validate } from './env/schema'
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
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const postgresUri = `postgresql://${env.DB_USERNAME}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`
        return {
          stores: [
            new KeyvPostgres({
              uri: postgresUri,
              table: 'app_cache',
            }),
          ],
          ttl: env.KV_TTL_SECONDS * 1000,
        }
      },
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
    AppCacheModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HelmetMiddleware, SessionMiddleware).forRoutes('{*path}')
  }
}
