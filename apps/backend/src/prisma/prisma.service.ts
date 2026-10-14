import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@repo/db'

import { Env } from '@/env/schema'

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService<Env, true>) {
    const adapter = new PrismaPg({
      host: config.get('DB_HOST', { infer: true }),
      port: config.get('DB_PORT', { infer: true }),
      user: config.get('DB_USERNAME', { infer: true }),
      password: config.get('DB_PASSWORD', { infer: true }),
      database: config.get('DB_NAME', { infer: true }),
    })

    super({ adapter })
  }
}
