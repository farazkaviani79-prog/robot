'use client';
import { useApi, fa } from '@/lib/client';
import { Empty, ErrorBox, Loading } from '@/components/ui';
export default function Admin() {
  const o = useApi<any>('admin/overview'); const t = useApi<any[]>('admin/tenants');
  if (o.loading) return <Loading />; if (o.error) return <ErrorBox msg={o.error.includes('مدیر کل') ? 'این بخش فقط برای مدیر کل سامانه است' : o.error} />;
  return <><h1>مدیر کل سامانه</h1><section className="grid">{[['کسب‌وکارها', o.data.tenants], ['کاربران', o.data.users], ['فروشگاه‌ها', o.data.stores], ['سفارش‌ها', o.data.orders], ['اشتراک فعال', o.data.activeSubs]].map(([l, v]) => <article key={l as string} className="card stat"><span className="mute">{l}</span><b>{fa(v as number)}</b></article>)}</section>
    <h2>کسب‌وکارها</h2>{t.loading ? <Loading /> : !t.data?.length ? <Empty text="کسب‌وکاری ثبت نشده" /> : <div className="card scroll"><table className="tbl"><thead><tr><th>نام</th><th>وضعیت</th><th>فروشگاه</th><th>اعضا</th><th>پلن</th></tr></thead><tbody>{t.data.map((x: any) => <tr key={x.id}><td>{x.name}</td><td><span className="badge">{x.status}</span></td><td>{fa(x._count.stores)}</td><td>{fa(x._count.memberships)}</td><td>{x.subscriptions[0]?.plan.name ?? '—'}</td></tr>)}</tbody></table></div>}</>;
}
