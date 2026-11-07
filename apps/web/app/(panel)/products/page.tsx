'use client';
import { useState } from 'react';
import { api, useApi, fa, rial, statusFa } from '@/lib/client';
import { Empty, ErrorBox, Loading, Pager, useDebounced } from '@/components/ui';
export default function Products() {
  const [q, setQ] = useState(''); const [page, setPage] = useState(1); const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any>(`products?${new URLSearchParams({ page: String(page), pageSize: '20', ...(dq && { q: dq }) })}`);
  const stores = useApi<any[]>('stores');
  const [f, setF] = useState({ name: '', sku: '', price: '', stock: '0' }); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    if (f.name.trim().length < 2) return setMsg('نام کالا حداقل ۲ حرف باشد'); if (!/^\d{1,15}$/.test(f.price)) return setMsg('قیمت باید عدد صحیح و بر حسب ریال باشد'); if (!f.sku) return setMsg('SKU را وارد کنید');
    const store = stores.data?.[0]; if (!store) return setMsg('ابتدا یک فروشگاه بسازید');
    setBusy(true);
    try { await api('products', { method: 'POST', body: JSON.stringify({ storeId: store.id, name: f.name, status: 'ACTIVE', variants: [{ sku: f.sku, priceAmount: f.price, initialStock: Number(f.stock) || 0 }] }) }); setF({ name: '', sku: '', price: '', stock: '0' }); setMsg('کالا ثبت شد ✓'); reload(); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  return <><h1>محصولات</h1>
    <form onSubmit={add} className="card" style={{ marginBottom: 16 }}><h2 style={{ marginTop: 0 }}>کالای جدید</h2>
      <div className="grid"><label><span>نام</span><input style={{ width: '100%' }} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label><span>SKU</span><input style={{ width: '100%' }} dir="ltr" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></label>
        <label><span>قیمت (ریال)</span><input style={{ width: '100%' }} dir="ltr" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
        <label><span>موجودی اولیه</span><input style={{ width: '100%' }} dir="ltr" inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></label></div>
      {msg && <p className={msg.includes('✓') ? '' : 'err'} role="status">{msg}</p>}<button className="btn" disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت کالا'}</button></form>
    <div className="toolbar"><input placeholder="جست‌وجوی نام یا SKU" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
    {loading ? <Loading /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.items.length ? <Empty text="هنوز کالایی ثبت نشده است" /> :
      <div className="card scroll"><table className="tbl"><thead><tr><th>نام</th><th>SKU</th><th>قیمت</th><th>موجودی</th><th>وضعیت</th></tr></thead>
        <tbody>{data.items.map((p: any) => { const v = p.variants[0]; const stock = p.variants.reduce((s: number, x: any) => s + x.balances.reduce((a: number, b: any) => a + b.onHand - b.reserved, 0), 0);
          return <tr key={p.id}><td>{p.name}</td><td dir="ltr">{v?.sku}</td><td>{v ? rial(v.priceAmount) : '—'}</td><td>{fa(stock)}</td><td><span className="badge">{statusFa[p.status]}</span></td></tr>; })}</tbody></table>
        <Pager page={data.page} pageCount={data.pageCount} onPage={setPage} /></div>}</>;
}
