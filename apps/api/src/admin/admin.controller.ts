import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Auth } from '../auth/auth.decorators';
import { PlatformAdminOnly } from '../auth/auth.guard';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
class SuspendDto { @IsIn(['ACTIVE', 'SUSPENDED']) status!: 'ACTIVE' | 'SUSPENDED'; @IsOptional() @IsString() @MaxLength(300) reason?: string; }

/** پنل مدیر کل: فقط با نقش botshop_system و فقط برای isPlatformAdmin؛ هر اقدام Audit می‌شود. */
@PlatformAdminOnly()
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  @Get('overview') async overview() {
    const s = this.prisma.system;
    const [tenants, users, stores, orders, activeSubs] = await Promise.all([s.tenant.count(), s.user.count(), s.store.count(), s.order.count(), s.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } })]);
    return { tenants, users, stores, orders, activeSubs };
  }
  @Get('tenants') tenants(@Query('q') q?: string) {
    return this.prisma.system.tenant.findMany({ where: q ? { name: { contains: q, mode: 'insensitive' } } : {}, include: { _count: { select: { stores: true, memberships: true } }, subscriptions: { take: 1, orderBy: { currentPeriodEnd: 'desc' }, include: { plan: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  @Get('audit') auditLogs(@Query('tenantId') tenantId?: string, @Query('action') action?: string) {
    return this.prisma.system.auditLog.findMany({ where: { ...(tenantId && { tenantId }), ...(action && { action: { startsWith: action } }) }, orderBy: { createdAt: 'desc' }, take: 200 });
  }
  @Get('webhook-events') failedWebhooks() { return this.prisma.system.webhookEvent.findMany({ where: { status: 'FAILED' }, orderBy: { receivedAt: 'desc' }, take: 100, select: { id: true, tenantId: true, channel: true, error: true, attempts: true, receivedAt: true } }); }
  @HttpCode(200) @Post('tenants/:id/status') async setStatus(@Auth() a: AuthContext, @Param('id') id: string, @Body() d: SuspendDto) {
    const r = await this.prisma.system.tenant.updateMany({ where: { id }, data: { status: d.status } });
    if (!r.count) throw new NotFoundException('کسب‌وکار یافت نشد');
    await this.audit.logSystem({ tenantId: id, actorUserId: a.userId, actorType: 'PLATFORM_ADMIN', action: 'admin.tenant_status', entityType: 'tenant', entityId: id, metadata: { status: d.status, reason: d.reason }, ip: a.ip });
    return { ok: true };
  }
}
