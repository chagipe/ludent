'use client';
import { sb } from '@/lib/supabase';
import { money, daysLeft, fdate, useData, Tag, Empty } from '@/lib/ui';

export default function Inicio() {
  const [d] = useData(async () => {
    const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
    const lim = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
    const [s, p, l] = await Promise.all([
      sb.from('sales').select('subtotal,sale_items(qty,price,cost,returned)').eq('status', 'ok').gte('created_at', m0.toISOString()),
      sb.from('products').select('id,name,cost,min_stock,product_stock(qty)'),
      sb.from('lots').select('ref,qty,expires_on,products(name)').gt('qty', 0).lte('expires_on', lim).order('expires_on'),
    ]);
    return { sales: s.data || [], products: p.data || [], lots: l.data || [] };
  });
  if (!d) return <Empty>Cargando…</Empty>;
  const stock = (p: any) => (p.product_stock || []).reduce((a: number, x: any) => a + x.qty, 0);
  const net = d.sales.reduce((a: number, s: any) => a + s.sale_items.reduce((b: number, i: any) => b + (i.qty - i.returned) * i.price, 0), 0);
  const profit = d.sales.reduce((a: number, s: any) => a + s.sale_items.reduce((b: number, i: any) => b + (i.qty - i.returned) * (i.price - i.cost), 0), 0);
  const value = d.products.reduce((a: number, p: any) => a + stock(p) * p.cost, 0);
  const low = d.products.filter((p: any) => stock(p) <= p.min_stock);
  return (
    <>
      <h2>Inicio</h2>
      <div className="g">
        <div className="c"><div className="k">Ventas del mes (sin IGV)</div><div className="v">{money(net)}</div></div>
        <div className="c"><div className="k">Utilidad bruta del mes</div><div className="v">{money(profit)}</div></div>
        <div className="c"><div className="k">Valor del inventario (costo)</div><div className="v">{money(value)}</div></div>
        <div className="c"><div className="k">Productos con stock bajo</div><div className="v" style={{ color: low.length ? 'var(--dg)' : 'var(--ok)' }}>{low.length}</div></div>
      </div>
      <div className="g2">
        <div className="c"><h3>Stock bajo</h3>{low.length ? low.slice(0, 10).map((p: any) => <div className="lg" key={p.id}><span>{p.name}</span><Tag k="low">{stock(p)} / mín {p.min_stock}</Tag></div>) : <Empty>Todo el stock está en orden</Empty>}</div>
        <div className="c"><h3>Lotes por vencer (90 días)</h3>{d.lots.length ? d.lots.slice(0, 10).map((l: any, i: number) => <div className="lg" key={i}><span>{l.products?.name} · {l.ref}</span><Tag k={(daysLeft(l.expires_on) ?? 0) < 0 ? 'low' : 'warn'}>{fdate(l.expires_on)}</Tag></div>) : <Empty>Sin lotes próximos a vencer</Empty>}</div>
      </div>
    </>
  );
}
