'use client';
import { useState } from 'react';
import { useApi, fa, rial, statusFa } from '@/lib/client';
import { Empty, ErrorBox, Loading, Pager, useDebounced } from '@/components/ui';
export default function Orders() {
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [sort, setSort] = useState('createdAt'); const [dir, setDir] = useState('desc'); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const qs = new URLSearchParams({ page: String(page), pageSize: '20', sort, dir, ...(dq && { q: dq }), ...(status && { status }) });
  const { data, error, loading, reload } = useApi<any>(`orders?${qs}`);
  return <><h1>سفارش‌ها</h1>
    <div className="toolbar"><input placeholder="جست‌وجوی شماره سفارش یا مشتری" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">همه وضعیت‌ها</option>{Object.entries(statusFa).filter(([k]) => !['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    {loading ? <Loading /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.items.length ? <Empty text="سفارشی یافت نشد" /> :
      <div className="card scroll"><table className="tbl"><thead><tr><th>شماره</th><th>مشتری</th><th>وضعیت</th>
        <th onClick={() => { setSort('totalAmount'); setDir(dir === 'asc' ? 'desc' : 'asc'); }}>مبلغ ⇅</th><th onClick={() => { setSort('createdAt'); setDir(dir === 'asc' ? 'desc' : 'asc'); }}>تاریخ ⇅</th></tr></thead>
        <tbody>{data.items.map((o: any) => <tr key={o.id}><td>{fa(o.orderNumber)}</td><td>{o.customer?.fullName ?? '—'}</td><td><span className="badge">{statusFa[o.status]}</span></td><td>{rial(o.totalAmount)}</td><td>{new Date(o.createdAt).toLocaleDateString('fa-IR')}</td></tr>)}</tbody></table>
        <Pager page={data.page} pageCount={data.pageCount} onPage={setPage} /></div>}</>;
}
