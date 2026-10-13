'use client';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase';
import { Tag, Empty, money, fdate, useData } from '@/lib/ui';

export default function Ordenes() {
  const router = useRouter();
  const [rows, reload] = useData(async () => (await sb.from('purchase_orders').select('*').order('created_at', { ascending: false })).data || []);
  function recv(o: any) { sessionStorage.setItem('prefill', JSON.stringify({ kind: 'purchase', party: o.supplier_id, order_id: o.id, lines: o.items })); router.push('/compras'); }
  async function anular(id: string) { await sb.from('purchase_orders').update({ status: 'anulada' }).eq('id', id); reload(); }
  return (
    <>
      <h2>Órdenes de compra</h2>
      <div className="bar"><button className="b" onClick={() => router.push('/compras')}>+ Nueva orden</button></div>
      <div className="c tw" style={{ padding: 0 }}>{(rows || []).length ? <table><thead><tr><th>N°</th><th>Fecha</th><th>Proveedor</th><th>Detalle</th><th className="r">Total</th><th>Estado</th><th /></tr></thead>
        <tbody>{rows!.map((o: any) => <tr key={o.id}><td>{o.number}</td><td>{fdate(o.created_at)}</td><td>{o.supplier_name}</td><td className="mu">{o.items.map((i: any) => i.qty + '× ' + i.name).join(', ').slice(0, 50)}</td><td className="r">{money(o.total)}</td>
          <td><Tag k={o.status === 'pendiente' ? 'warn' : o.status === 'recibida' ? 'good' : 'anu'}>{o.status}</Tag></td>
          <td className="r">{o.status === 'pendiente' && <><button className="b" onClick={() => recv(o)}>Recibir</button> <button className="s d" onClick={() => anular(o.id)}>Anular</button></>}</td></tr>)}</tbody></table> : <Empty>Sin órdenes. Crea una desde Compras con "Guardar como orden de compra".</Empty>}</div>
    </>
  );
}
