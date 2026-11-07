import { createHmac, timingSafeEqual } from 'node:crypto';

/** JWT حداقلی HS256؛ الگوریتم ثابت است (جلوگیری از حمله alg=none) و exp الزامی. */
export interface AccessClaims { sub: string; tid?: string; role?: string; adm?: boolean; iat: number; exp: number; }
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function signJwt(claims: Omit<AccessClaims, 'iat' | 'exp'>, secret: string, ttlSeconds: number, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...claims, iat, exp: iat + ttlSeconds });
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
export function verifyJwt(token: string, secret: string, now = Date.now()): AccessClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const given = Buffer.from(parts[2], 'base64url');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as AccessClaims;
    if (typeof claims.exp !== 'number' || typeof claims.sub !== 'string' || claims.exp * 1000 <= now) return null;
    return claims;
  } catch { return null; }
}
