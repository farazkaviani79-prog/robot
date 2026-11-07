import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth/auth.guard';
import { PrismaService } from './prisma/prisma.service';
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Public() @Get('health') async health() {
    try { await this.prisma.system.$queryRaw`SELECT 1`; } catch { throw new ServiceUnavailableException({ status: 'db_down' }); }
    return { service: 'botshop-api', status: 'ok', timestamp: new Date().toISOString() };
  }
}
