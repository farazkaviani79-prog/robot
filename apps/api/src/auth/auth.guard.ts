import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyJwt } from '../common/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthContext, ROLE_RANK, Role } from './auth.types';

export const IS_PUBLIC = 'isPublic'; export const Public = () => SetMetadata(IS_PUBLIC, true);
export const MIN_ROLE = 'minRole'; export const MinRole = (r: Role) => SetMetadata(MIN_ROLE, r);
export const PLATFORM_ADMIN = 'platformAdmin'; export const PlatformAdminOnly = () => SetMetadata(PLATFORM_ADMIN, true);

/** گارد سراسری: JWT را بررسی می‌کند، عضویت و وضعیت کاربر/مستاجر را از دیتابیس تأیید می‌کند، سپس نقش حداقلی را اعمال می‌کند. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const claims = token ? verifyJwt(token, process.env.JWT_SECRET!) : null;
    if (!claims) throw new UnauthorizedException('نشست نامعتبر یا منقضی است');

    const user = await this.prisma.system.user.findUnique({ where: { id: claims.sub }, select: { id: true, status: true, isPlatformAdmin: true } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('حساب کاربری فعال نیست');

    let tenantId: string | null = null; let role: Role | null = null;
    if (claims.tid) {
      const m = await this.prisma.system.membership.findFirst({ where: { tenantId: claims.tid, userId: user.id }, select: { role: true, tenant: { select: { status: true } } } });
      if (!m || m.tenant.status !== 'ACTIVE') throw new ForbiddenException('دسترسی به این کسب‌وکار وجود ندارد');
      tenantId = claims.tid; role = m.role as Role; // نقش از دیتابیس خوانده می‌شود، نه از توکن
    }
    const auth: AuthContext = { userId: user.id, tenantId, role, isPlatformAdmin: user.isPlatformAdmin, ip: req.ip, userAgent: req.headers['user-agent'] };
    req.auth = auth;

    if (this.reflector.getAllAndOverride<boolean>(PLATFORM_ADMIN, targets)) {
      if (!auth.isPlatformAdmin) throw new ForbiddenException('فقط مدیر کل سامانه');
      return true;
    }
    if (!tenantId) throw new ForbiddenException('ابتدا یک کسب‌وکار را انتخاب کنید');
    const min = this.reflector.getAllAndOverride<Role>(MIN_ROLE, targets);
    if (min && ROLE_RANK[role!] < ROLE_RANK[min]) throw new ForbiddenException('سطح دسترسی شما کافی نیست');
    return true;
  }
}
