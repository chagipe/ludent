'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { sb } from '@/lib/supabase';
import { money, useData, Empty } from '@/lib/ui';

const iso = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
export default function Reportes() {
  const [f, setF] = useState(iso(-30)); const [t, setT] = useState(iso(0));
  const [d] = useData(async () => {
    const [s, p] = await Promise.all([
      sb.from('sales').select('*,sale_items(*)').eq('status', 'ok').gte('created_at', f + 'T00:00:00').lte('created_at', t + 'T23:59:59'),
      sb.from('profiles').select('id,full_name'),
    ]);
    return { s: s.data || [], u: Object.fromEntries((p.data || []).map((x: any) => [x.id, x.full_name])) };
  }, [f, t]);
  if (!d) return <Empty>Cargando…</Empty>;
  const A: any = {}, B: any = {}, E: any = {}; let T = 0, U = 0;
  d.s.forEach((s: any) => {
    let n = 0;
    s.sale_items.forEach((i: any) => { const q = i.qty - i.returned, v = q * i.price, m = v - q * i.cost, a = (A[i.product_id] ||= { n: i.name, q: 0, t: 0, u: 0 }); a.q += q; a.t += v; a.u += m; n += v; U += m; });
    T += n; const c = (B[s.customer_name] ||= { n: s.customer_name, q: 0, t: 0 }); c.q++; c.t += n;
    const k = s.created_by || '', e = (E[k] ||= { n: d.u[k] || 'Sin registro', q: 0, t: 0 }); e.q++; e.t += n;
  });
  const tb = (title: string, h: string[], l: any[], row: (x: any) => any[]) => (
    <div className="c tw" style={{ padding: 0, marginBottom: 14 }}><h3 style={{ padding: '14px 14px 0' }}>{title}</h3>
      <table><thead><tr>{h.map((x, i) => <th key={x} className={i ? 'r' : ''}>{x}</th>)}</tr></thead>
        <tbody>{l.sort((a, b) => b.t - a.t).map((x, i) => <tr key={i}>{row(x).map((c, j) => <td key={j} className={j ? 'r' : ''}>{c}</td>)}</tr>)}</tbody></table></div>
  );
  function xls() {
    const wb = XLSX.utils.book_new(), add = (n: string, r: any[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.length ? r : [{}]), n);
    add('Ventas', d!.s.map((s: any) => ({ Documento: s.number, Fecha: s.created_at.slice(0, 10), Cliente: s.customer_name, Pago: s.pay_method, Subtotal: s.subtotal, IGV: s.igv, Total: s.total, Saldo: +(s.total - s.credited - s.paid).toFixed(2) })));
    add('Detalle', d!.s.flatMap((s: any) => s.sale_items.map((i: any) => ({ Documento: s.number, SKU: i.sku, Producto: i.name, Cantidad: i.qty, Devuelto: i.returned, Precio: i.price, Costo: i.cost }))));
    XLSX.writeFile(wb, `ventas-${f}_${t}.xlsx`);
  }
  return (
    <>
      <h2>Reportes de ventas</h2>
      <div className="bar">Desde <input type="date" value={f} onChange={(e) => setF(e.target.value)} /> Hasta <input type="date" value={t} onChange={(e) => setT(e.target.value)} /><button className="b" onClick={xls}>Exportar a Excel</button></div>
      <div className="g"><div className="c"><div className="k">Ventas netas (sin IGV)</div><div className="v">{money(T)}</div></div><div className="c"><div className="k">Utilidad bruta</div><div className="v">{money(U)}</div></div><div className="c"><div className="k">Margen</div><div className="v">{T ? Math.round((U / T) * 100) : 0}%</div></div><div className="c"><div className="k">Ticket promedio</div><div className="v">{money(d.s.length ? T / d.s.length : 0)}</div></div></div>
      {tb('Por producto', ['Producto', 'Unidades', 'Ventas', 'Utilidad'], Object.values(A), (x) => [x.n, x.q, money(x.t), money(x.u)])}
      {tb('Por cliente', ['Cliente', 'Documentos', 'Ventas'], Object.values(B), (x) => [x.n, x.q, money(x.t)])}
      {tb('Por vendedor', ['Vendedor', 'Documentos', 'Ventas'], Object.values(E), (x) => [x.n, x.q, money(x.t)])}
    </>
  );
}
