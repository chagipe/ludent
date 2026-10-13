'use client';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase';
import { Tag, useData, Empty } from '@/lib/ui';

export default function Reposicion() {
  const router = useRouter();
  const [d] = useData(async () => {
    const d0 = new Date(Date.now() - 30 * 864e5).toISOString();
    const [p, s, o] = await Promise.all([
      sb.from('products').select('id,name,cost,min_stock,supplier_id,suppliers(name),product_stock(qty)'),
      sb.from('sale_items').select('product_id,qty,returned,sales!inner(created_at,status)').eq('sales.status', 'ok').gte('sales.created_at', d0),
      sb.from('purchase_orders').select('items').eq('status', 'pendiente'),
    ]);
    return { p: p.data || [], s: s.data || [], o: o.data || [] };
  });
  if (!d) return <Empty>Cargando…</Empty>;
  const sold: any = {}, ord: any = {};
  d.s.forEach((i: any) => (sold[i.product_id] = (sold[i.product_id] || 0) + i.qty - i.returned));
  d.o.forEach((o: any) => o.items.forEach((i: any) => (ord[i.product_id] = (ord[i.product_id] || 0) + i.qty)));
  const rows = d.p.map((p: any) => {
    const st = p.product_stock.reduce((a: number, x: any) => a + x.qty, 0), v = sold[p.id] || 0, o = ord[p.id] || 0;
    const sug = Math.max(0, Math.max(p.min_stock * 2, Math.ceil(v * 1.5)) - st - o), cov = v ? Math.floor(st / (v / 30)) : null;
    return { p, st, v, o, sug, cov };
  }).filter((x: any) => x.sug > 0 && (x.st <= x.p.min_stock || (x.cov != null && x.cov < 15)));
  const groups: any = {}; rows.forEach((x: any) => { if (x.p.supplier_id) (groups[x.p.supplier_id] = groups[x.p.supplier_id] || []).push(x); });
  function prep(k: string) {
    sessionStorage.setItem('prefill', JSON.stringify({ kind: 'purchase', party: k, lines: groups[k].map((x: any) => ({ product_id: x.p.id, name: x.p.name, qty: x.sug, cost: x.p.cost })) }));
    router.push('/compras');
  }
  return (
    <>
      <h2>Reposición sugerida</h2>
      <div className="bar">{Object.keys(groups).map((k) => <button key={k} className="b" onClick={() => prep(k)}>Preparar orden · {groups[k][0].p.suppliers?.name} ({groups[k].length})</button>)}</div>
      <div className="c tw" style={{ padding: 0 }}>{rows.length ? <table><thead><tr><th>Producto</th><th>Proveedor</th><th className="r">Stock</th><th className="r">Mín.</th><th className="r">Vendido 30 d</th><th className="r">Cobertura</th><th className="r">En órdenes</th><th className="r">Sugerido</th></tr></thead>
        <tbody>{rows.map((x: any) => <tr key={x.p.id}><td>{x.p.name}</td><td>{x.p.suppliers?.name || '—'}</td><td className="r"><Tag k="low">{x.st}</Tag></td><td className="r">{x.p.min_stock}</td><td className="r">{x.v}</td><td className="r">{x.cov == null ? '—' : x.cov + ' d'}</td><td className="r">{x.o}</td><td className="r"><b>{x.sug}</b></td></tr>)}</tbody></table> : <Empty>Sin necesidad de reposición</Empty>}</div>
      <p className="mu">Sugerido = el mayor entre 2× el stock mínimo y 1,5× lo vendido en 30 días, menos el stock y lo ya pedido.</p>
    </>
  );
}
