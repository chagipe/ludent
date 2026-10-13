'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase';
import { money, rpc, toast, useData, Thumb, Empty } from '@/lib/ui';

export default function Campo() {
  const router = useRouter(); const [cust, setCust] = useState(''); const [q, setQ] = useState(''); const [cart, setCart] = useState<Record<string, number>>({});
  const [d] = useData(async () => {
    const [p, c, w] = await Promise.all([sb.from('products').select('id,sku,barcode,name,image_url,price,price_wholesale,product_stock(qty)').order('name'), sb.from('customers').select('*').order('name'), sb.from('warehouses').select('id').eq('is_default', true).single()]);
    return { p: p.data || [], c: c.data || [], w: w.data };
  });
  if (!d) return <Empty>Cargando…</Empty>;
  const cu = d.c.find((x: any) => x.id === cust);
  const price = (p: any) => +(((cu?.price_list === 'Mayorista' && p.price_wholesale) || p.price) * (1 - (cu?.discount || 0) / 100)).toFixed(2);
  const stock = (p: any) => p.product_stock.reduce((a: number, x: any) => a + x.qty, 0);
  const list = d.p.filter((p: any) => (p.name + p.sku + (p.barcode || '')).toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  const chg = (p: any, n: number) => { const v = (cart[p.id] || 0) + n; if (v < 0) return; if (v > stock(p)) return toast('Stock insuficiente'); setCart({ ...cart, [p.id]: v }); };
  const lines = d.p.filter((p: any) => cart[p.id] > 0).map((p: any) => ({ product_id: p.id, name: p.name, img: p.image_url, qty: cart[p.id], price: price(p) }));
  const total = lines.reduce((a: number, l: any) => a + l.qty * l.price, 0) * 1.18;
  async function send() {
    if (!cust) return toast('Selecciona un cliente'); if (!lines.length) return toast('Agrega productos');
    try {
      const number = await rpc('next_number', { s: 'COT' });
      const { error } = await sb.from('quotes').insert({ number, customer_id: cust, customer_name: cu.name, items: lines, total: +total.toFixed(2), valid_until: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10) });
      if (error) return toast(error.message); toast('Pedido enviado'); router.push('/cotizaciones');
    } catch {}
  }
  return (
    <>
      <h2>Pedido en campo</h2>
      <div className="c"><select style={{ width: '100%', fontSize: 16, padding: 12 }} value={cust} onChange={(e) => setCust(e.target.value)}><option value="">Selecciona cliente</option>{d.c.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input type="search" placeholder="Buscar producto o código" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginTop: 10, fontSize: 16, padding: 12 }} /></div>
      {list.map((p: any) => <div className="c" key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Thumb url={p.image_url} name={p.name} size={56} /><div><b>{p.name}</b><div className="mu">{money(price(p))} · stock {stock(p)}</div></div></div>
        <div className="bar" style={{ margin: 0, flexWrap: 'nowrap' }}><button className="s" onClick={() => chg(p, -1)}>-</button><b style={{ minWidth: 22, textAlign: 'center' }}>{cart[p.id] || 0}</b><button className="b" onClick={() => chg(p, 1)}>+</button></div></div>)}
      <div className="c" style={{ position: 'sticky', bottom: 0 }}><div className="lg"><b>Total (con IGV)</b><b>{money(total)}</b></div><button className="b" style={{ width: '100%', padding: 12 }} onClick={send}>Enviar pedido (cotización)</button></div>
    </>
  );
}
