'use client';
import { useApi, fa, rial, statusFa } from '@/lib/client';
import { Bars, ErrorBox, Loading, Empty } from '@/components/ui';
export default function Dashboard() {
  const { data, error, loading, reload } = useApi<any>('reports/dashboard');
  if (loading) return <Loading />; if (error) return <ErrorBox msg={error} retry={reload} />; if (!data) return null;
  const cards: [string, string][] = [['فروش امروز', rial(data.todaySales)], ['سفارش‌های امروز', fa(data.ordersToday)], ['محصولات فعال', fa(data.activeProducts)], ['موجودی کم', fa(data.lowStock)], ['مشتریان', fa(data.customers)]];
  return <><h1>داشبورد</h1>
    <section className="grid">{cards.map(([l, v]) => <article key={l} className="card stat"><span className="mute">{l}</span><b>{v}</b></article>)}</section>
    <section className="card" style={{ marginTop: 16 }}><h2 style={{ marginTop: 0 }}>فروش ۳۰ روز اخیر</h2>
      {data.daily.length ? <Bars values={data.daily.map((d: any) => Number(d.total))} labels={data.daily.map((d: any) => d.day)} /> : <Empty text="هنوز فروشی ثبت نشده است" />}</section>
    <section className="grid" style={{ marginTop: 16 }}>
      <article className="card"><h2 style={{ marginTop: 0 }}>پرفروش‌ترین‌ها</h2>{data.topProducts.length ? data.topProducts.map((t: any) => <p key={t.name}>{t.name} — {fa(t.qty)} عدد <span className="mute">({rial(t.revenue)})</span></p>) : <span className="mute">—</span>}</article>
      <article className="card"><h2 style={{ marginTop: 0 }}>وضعیت سفارش‌ها</h2>{data.byStatus.length ? data.byStatus.map((s: any) => <p key={s.status}><span className="badge">{statusFa[s.status]}</span> {fa(s.count)}</p>) : <span className="mute">—</span>}</article>
    </section></>;
}
