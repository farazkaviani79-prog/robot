import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API, clearSession } from '@/lib/server';
export async function POST() {
  const rt = cookies().get('bs_rt')?.value;
  if (rt) await fetch(`${API}/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) }).catch(() => undefined);
  clearSession(); return NextResponse.json({ ok: true });
}
