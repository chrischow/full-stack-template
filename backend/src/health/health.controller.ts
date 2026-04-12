import { Controller, Get } from '@nestjs/common'
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus'

import { PrismaService } from '@/prisma/prisma.service'

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  healthCheck() {
    return this.healthCheckService.check([() => this.prisma.pingCheck('prisma', this.prismaService)])
  }
}
