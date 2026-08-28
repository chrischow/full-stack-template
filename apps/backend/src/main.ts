import { VersioningType } from '@nestjs/common'
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { env } from 'process'

import { AppModule } from './app.module'
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

  await app.listen(env.APP_PORT ?? 3000)
}
bootstrap()
