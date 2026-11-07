import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashPassword, randomToken, sha256Hex, verifyPassword } from '../common/crypto';
import { signJwt } from '../common/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const ACCESS_TTL = 15 * 60; const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_FAILS = 5; const LOCK_MS = 15 * 60 * 1000;
const TRIAL_PLAN = 'starter'; const TRIAL_DAYS = 14;
// برای جلوگیری از Timing Attack در کاربر ناموجود
const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async register(input: { email: string; password: string; displayName: string; businessName: string }, meta: { ip?: string; userAgent?: string }) {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await hashPassword(input.password);
    try {
      const out = await this.prisma.system.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { email, passwordHash, displayName: input.displayName } });
        const tenant = await tx.tenant.create({ data: { name: input.businessName, slug: 't-' + randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, 'x') } });
        await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: 'OWNER' } });
        const plan = await tx.plan.findUnique({ where: { code: TRIAL_PLAN } });
        if (plan) {
          const now = new Date();
          await tx.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: 'TRIALING', currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + TRIAL_DAYS * 86400_000) } });
        }
        await tx.auditLog.create({ data: { tenantId: tenant.id, actorUserId: user.id, actorType: 'USER', action: 'auth.register', entityType: 'user', entityId: user.id, ip: meta.ip, userAgent: meta.userAgent, metadata: {} } });
        return { user, tenant };
      });
      return this.issue(out.user.id, out.tenant.id, 'OWNER', meta);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('این ایمیل قبلاً ثبت شده است');
      throw e;
    }
  }

  async login(emailRaw: string, password: string, meta: { ip?: string; userAgent?: string }) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.system.user.findUnique({ where: { email } });
    const locked = user?.lockedUntil && user.lockedUntil > new Date();
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || locked || !ok || user.status !== 'ACTIVE') {
      if (user && !locked) {
        const fails = user.failedLoginCount + 1;
        await this.prisma.system.user.update({ where: { id: user.id }, data: { failedLoginCount: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null } });
      }
      await this.audit.logSystem({ actorUserId: user?.id, actorType: 'USER', action: 'auth.login_failed', entityType: 'user', entityId: user?.id, metadata: { locked: !!locked }, ip: meta.ip, userAgent: meta.userAgent });
      throw new UnauthorizedException(locked ? 'حساب موقتاً قفل شده است؛ چند دقیقه بعد تلاش کنید' : 'ایمیل یا رمز عبور نادرست است');
    }
    await this.prisma.system.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const m = await this.prisma.system.membership.findFirst({ where: { userId: user.id, tenant: { status: 'ACTIVE' } }, orderBy: { createdAt: 'asc' } });
    return this.issue(user.id, m?.tenantId ?? null, (m?.role as any) ?? null, meta);
  }

  async switchTenant(userId: string, tenantId: string, meta: { ip?: string; userAgent?: string }) {
    const m = await this.prisma.system.membership.findFirst({ where: { userId, tenantId, tenant: { status: 'ACTIVE' } } });
    if (!m) throw new ForbiddenException('دسترسی به این کسب‌وکار وجود ندارد');
    return this.issue(userId, tenantId, m.role as any, meta);
  }

  /** چرخش Refresh Token؛ استفاده مجدد از توکن باطل‌شده تمام نشست‌های کاربر را باطل می‌کند. */
  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const row = await this.prisma.system.refreshSession.findUnique({ where: { tokenHash: sha256Hex(refreshToken) } });
    if (!row) throw new UnauthorizedException('نشست نامعتبر است');
    if (row.revokedAt) {
      await this.prisma.system.refreshSession.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.logSystem({ actorUserId: row.userId, action: 'auth.refresh_reuse_detected', ip: meta.ip });
      throw new UnauthorizedException('نشست نامعتبر است');
    }
    if (row.expiresAt < new Date()) throw new UnauthorizedException('نشست منقضی شده است');
    await this.prisma.system.refreshSession.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    const m = await this.prisma.system.membership.findFirst({ where: { userId: row.userId, tenant: { status: 'ACTIVE' } }, orderBy: { createdAt: 'asc' } });
    return this.issue(row.userId, m?.tenantId ?? null, (m?.role as any) ?? null, meta);
  }

  async logout(refreshToken: string) {
    await this.prisma.system.refreshSession.updateMany({ where: { tokenHash: sha256Hex(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(userId: string) {
    const u = await this.prisma.system.user.findUnique({ where: { id: userId }, select: { id: true, email: true, displayName: true, isPlatformAdmin: true, memberships: { select: { role: true, tenant: { select: { id: true, name: true } } } } } });
    if (!u) throw new BadRequestException();
    return u;
  }

  private async issue(userId: string, tenantId: string | null, role: string | null, meta: { ip?: string; userAgent?: string }) {
    const accessToken = signJwt({ sub: userId, tid: tenantId ?? undefined, role: role ?? undefined }, process.env.JWT_SECRET!, ACCESS_TTL);
    const refreshToken = randomToken(48);
    await this.prisma.system.refreshSession.create({ data: { userId, tokenHash: sha256Hex(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS), ip: meta.ip, userAgent: meta.userAgent?.slice(0, 255) } });
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL, tenantId, role };
  }
}
