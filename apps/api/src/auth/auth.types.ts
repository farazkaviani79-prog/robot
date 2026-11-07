export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';
export const ROLE_RANK: Record<Role, number> = { STAFF: 1, MANAGER: 2, ADMIN: 3, OWNER: 4 };
export interface AuthContext { userId: string; tenantId: string | null; role: Role | null; isPlatformAdmin: boolean; ip?: string; userAgent?: string; }
