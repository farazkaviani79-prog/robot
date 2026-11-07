import { Controller, Get } from '@nestjs/common';
import { TenantId } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
@Controller()
export class SubscriptionsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('plans') plans() { return this.prisma.system.plan.findMany({ where: { isActive: true }, orderBy: { priceAmount: 'asc' } }); }
  @Get('subscription') current(@TenantId() t: string) {
    return this.prisma.withTenant(t, (tx) => tx.subscription.findFirst({ where: { tenantId: t }, orderBy: { currentPeriodEnd: 'desc' }, include: { plan: true, invoices: { orderBy: { createdAt: 'desc' }, take: 12 } } }));
  }
}
