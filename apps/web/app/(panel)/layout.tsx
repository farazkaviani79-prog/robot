'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links = [['/dashboard', 'داشبورد'], ['/products', 'محصولات'], ['/orders', 'سفارش‌ها'], ['/admin', 'مدیر کل']];
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  async function out() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }
  return <div className="shell"><nav className="side" aria-label="منوی اصلی"><h1>BotShop</h1>{links.map(([h, t]) => <Link key={h} href={h} className={p.startsWith(h) ? 'on' : ''}>{t}</Link>)}<a href="#" onClick={(e) => { e.preventDefault(); out(); }}>خروج</a></nav><main className="main">{children}</main></div>;
}
