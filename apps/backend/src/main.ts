import { VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'

import { AppModule } from './app.module'
import { Env } from './env/schema'
import { LoggerExceptionFilter } from './logger'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  })

  app.setGlobalPrefix('/api')
  app.useLogger(app.get(Logger))
  app.useGlobalFilters(new LoggerExceptionFilter(app.get(HttpAdapterHost)))

  const config = app.get<ConfigService<Env, true>>(ConfigService)
  await app.listen(config.get('APP_PORT', { infer: true }))
}
bootstrap()
