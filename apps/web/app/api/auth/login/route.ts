import { NextResponse } from 'next/server';
import { API, setSession } from '@/lib/server';
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: body.email, password: body.password }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return NextResponse.json({ message: j.message ?? 'ورود ناموفق بود' }, { status: r.status });
  setSession(j); return NextResponse.json({ ok: true, role: j.role });
}
