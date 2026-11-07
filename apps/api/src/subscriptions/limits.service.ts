import { ForbiddenException, Injectable } from '@nestjs/common';
import { Tx } from '../prisma/prisma.service';

export interface PlanLimits { maxStores: number; maxProducts: number; maxOrdersPerMonth: number; maxStaff: number; }
/** مقدار -1 یعنی نامحدود. */
@Injectable()
export class LimitsService {
  async activeLimits(tx: Tx, tenantId: string): Promise<PlanLimits> {
    const sub = await tx.subscription.findFirst({ where: { tenantId, status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] }, currentPeriodEnd: { gt: new Date() } }, orderBy: { currentPeriodEnd: 'desc' }, include: { plan: true } });
    if (!sub) throw new ForbiddenException('اشتراک فعال وجود ندارد؛ لطفاً اشتراک را تمدید کنید');
    return sub.plan.limits as unknown as PlanLimits;
  }
  async assertCanCreate(tx: Tx, tenantId: string, what: keyof PlanLimits) {
    const limits = await this.activeLimits(tx, tenantId);
    const max = limits[what]; if (max === -1) return;
    const current = what === 'maxStores' ? await tx.store.count({ where: { tenantId } })
      : what === 'maxProducts' ? await tx.product.count({ where: { tenantId, deletedAt: null } })
      : what === 'maxStaff' ? await tx.membership.count({ where: { tenantId } })
      : await tx.order.count({ where: { tenantId, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } });
    if (current >= max) throw new ForbiddenException('به سقف پلن اشتراک خود رسیده‌اید؛ برای ادامه پلن را ارتقا دهید');
  }
}
