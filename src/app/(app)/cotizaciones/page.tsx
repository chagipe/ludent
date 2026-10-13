'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase';
import { Tag, Empty, money, fdate, useData } from '@/lib/ui';
import { Comprobante } from '@/lib/doc';

export default function Cotizaciones() {
  const router = useRouter(); const [view, setView] = useState<any>(null);
  const [rows, reload] = useData(async () => (await sb.from('quotes').select('*').order('created_at', { ascending: false })).data || []);
  function toSale(q: any) { sessionStorage.setItem('prefill', JSON.stringify({ kind: 'sale', party: q.customer_id || '', quote_id: q.id, lines: q.items })); router.push('/ventas/nueva'); }
  async function anular(id: string) { await sb.from('quotes').update({ status: 'anulada' }).eq('id', id); reload(); }
  return (
    <>
      <h2>Cotizaciones</h2>
      <div className="bar"><button className="b" onClick={() => router.push('/ventas/nueva')}>+ Nueva cotización</button></div>
      <div className="c tw" style={{ padding: 0 }}>{(rows || []).length ? <table><thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Detalle</th><th className="r">Total</th><th>Estado</th><th /></tr></thead>
        <tbody>{rows!.map((q: any) => <tr key={q.id}><td>{q.number}</td><td>{fdate(q.created_at)}</td><td>{q.customer_name}</td><td className="mu">{q.items.map((i: any) => i.qty + '× ' + i.name).join(', ').slice(0, 50)}</td><td className="r">{money(q.total)}</td>
          <td><Tag k={q.status === 'vigente' ? 'warn' : q.status === 'convertida' ? 'good' : 'anu'}>{q.status}</Tag></td>
          <td className="r"><button className="s" onClick={() => setView({ ...q, items: q.items.map((i: any) => ({ ...i, price: i.price })), subtotal: q.total / 1.18 })}>Ver</button> {q.status === 'vigente' && <><button className="b" onClick={() => toSale(q)}>Convertir en venta</button> <button className="s d" onClick={() => anular(q.id)}>Anular</button></>}</td></tr>)}</tbody></table> : <Empty>Sin cotizaciones. Arma el detalle en Nueva venta y usa "Guardar como cotización".</Empty>}</div>
      {view && <Comprobante d={view} onClose={() => setView(null)} />}
    </>
  );
}
