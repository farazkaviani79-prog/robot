import { Injectable } from '@nestjs/common';
import { PrismaService, Tx } from '../prisma/prisma.service';

export interface AuditEntry { tenantId?: string | null; actorUserId?: string | null; actorType?: 'USER' | 'CUSTOMER' | 'SYSTEM' | 'PLATFORM_ADMIN'; action: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown>; ip?: string; userAgent?: string; }
const SENSITIVE = /token|secret|password|hash|key/i;
export function scrub(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(scrub);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, SENSITIVE.test(k) ? '[REDACTED]' : scrub(v)]));
  return typeof o === 'bigint' ? o.toString() : o;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  /** درون تراکنش مستاجر (ترجیحی: ثبت Audit و عملیات هم‌زمان commit می‌شوند). */
  async logTx(tx: Tx, e: AuditEntry) {
    await tx.auditLog.create({ data: { tenantId: e.tenantId ?? null, actorUserId: e.actorUserId ?? null, actorType: e.actorType ?? 'USER', action: e.action, entityType: e.entityType, entityId: e.entityId, metadata: scrub(e.metadata ?? {}) as object, ip: e.ip, userAgent: e.userAgent } });
  }
  /** برای رویدادهای بدون مستاجر (ورود ناموفق، اقدامات مدیر کل). */
  async logSystem(e: AuditEntry) {
    await this.prisma.system.auditLog.create({ data: { tenantId: e.tenantId ?? null, actorUserId: e.actorUserId ?? null, actorType: e.actorType ?? 'SYSTEM', action: e.action, entityType: e.entityType, entityId: e.entityId, metadata: scrub(e.metadata ?? {}) as object, ip: e.ip, userAgent: e.userAgent } });
  }
}
