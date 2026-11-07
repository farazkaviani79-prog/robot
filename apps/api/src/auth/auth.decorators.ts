import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from './auth.types';
export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => ctx.switchToHttp().getRequest().auth);
/** tenantId همیشه از نشست احرازشده می‌آید، هرگز از Body/Query. */
export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const a = ctx.switchToHttp().getRequest().auth as AuthContext; if (!a?.tenantId) throw new Error('no tenant'); return a.tenantId;
});
