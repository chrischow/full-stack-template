import { Injectable } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'

import { env } from '@/env/schema'
import { PrismaClient } from '@/generated/prisma/client'

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const adapter = new PrismaPg({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    })

    super({ adapter })
  }
}
