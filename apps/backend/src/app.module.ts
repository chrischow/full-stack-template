import { KeyvPostgres } from '@keyv/postgres'
import { CacheModule } from '@nestjs/cache-manager'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { REQUEST } from '@nestjs/core'
import { ServeStaticModule } from '@nestjs/serve-static'
import { onError, ORPCError, ORPCModule } from '@orpc/nest'
import { experimental_RethrowHandlerPlugin as RethrowHandlerPlugin } from '@orpc/server/plugins'
import { Request, Response } from 'express'
import { LoggerModule } from 'nestjs-pino'
import { join, resolve } from 'path'

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
import { UserModule } from './user/user.module'

const FRONTEND_PATH = resolve(__dirname, '..', '..', '..', 'apps', 'frontend', 'dist')

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
    ServeStaticModule.forRoot({
      rootPath: FRONTEND_PATH,
      exclude: ['/api/{*path}'],
      serveStaticOptions: {
        maxAge: 2 * 60 * 60 * 1000,
        setHeaders: (res: Response, path: string) => {
          const HEADERS = {
            'Content-Security-Policy':
              "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests",
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Resource-Policy': 'same-origin',
            'Origin-Agent-Cluster': '?1',
            'Referrer-Policy': 'no-referrer',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            'X-Content-Type-Options': 'nosniff',
            'X-DNS-Prefetch-Control': 'off',
            'X-Download-Options': 'noopen',
            'X-Frame-Options': 'SAMEORIGIN',
            'X-Permitted-Cross-Domain-Policies': 'none',
            'X-XSS-Protection': '0',
          }
          res.set(HEADERS)
          // Set maxAge to 0 for root
          if (path === join(FRONTEND_PATH, 'index.html')) {
            res.setHeader('Cache-control', 'public, max-age=0')
          }
        },
      },
    }),
    PrismaModule,
    AuthModule,
    MailModule,
    AppCacheModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HelmetMiddleware, SessionMiddleware).forRoutes('{*path}')
  }
}
