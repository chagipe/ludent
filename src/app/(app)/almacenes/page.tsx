'use client';
import { useState } from 'react';
import { sb } from '@/lib/supabase';
import { Crud, Modal, Tag, Thumb, rpc, toast, useData, useMe, fdate, daysLeft, Empty } from '@/lib/ui';

export default function Almacenes() {
  const me = useMe(); const [m, setM] = useState<any>(null);
  const [d, reload] = useData(async () => {
    const [w, p, l] = await Promise.all([sb.from('warehouses').select('*').order('name'), sb.from('products').select('id,sku,name,image_url,product_stock(warehouse_id,qty)').order('name'), sb.from('lots').select('*,products(name),warehouses(name)').gt('qty', 0).order('expires_on')]);
    return { w: w.data || [], p: p.data || [], l: l.data || [] };
  });
  if (!d) return <Empty>Cargando…</Empty>;
  const q = (p: any, w: string) => p.product_stock.find((x: any) => x.warehouse_id === w)?.qty || 0;
  async function go() {
    try {
      if (m.t === 'adj') await rpc('adjust_stock', { p_product: m.p.id, p_warehouse: m.w, p_new: +m.n, p_note: m.note || null });
      else await rpc('transfer_stock', { p_product: m.p.id, p_from: m.w, p_to: m.to, p_qty: +m.n });
      toast('Listo'); setM(null); reload();
    } catch {}
  }
  return (
    <>
      <Crud table="warehouses" title="Almacenes" can={me.role === 'admin'} fields={[{ k: 'name', l: 'Nombre' }]} cols={[{ l: 'Almacén', r: (r) => r.name }, { l: 'Predeterminado', r: (r) => (r.is_default ? 'Sí' : '') }]} />
      <h2>Stock por almacén</h2>
      <div className="c tw" style={{ padding: 0 }}><table><thead><tr><th>SKU</th><th>Producto</th>{d.w.map((w: any) => <th key={w.id} className="r">{w.name}</th>)}<th /></tr></thead>
        <tbody>{d.p.map((p: any) => <tr key={p.id}><td>{p.sku}</td><td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Thumb url={p.image_url} name={p.name} size={32} />{p.name}</div></td>{d.w.map((w: any) => <td key={w.id} className="r">{q(p, w.id)}</td>)}
          <td className="r"><button className="s" onClick={() => setM({ t: 'adj', p, w: d.w[0].id, n: q(p, d.w[0].id) })}>Ajustar</button> <button className="s" disabled={d.w.length < 2} onClick={() => setM({ t: 'tr', p, w: d.w[0].id, to: d.w[1]?.id, n: 1 })}>Transferir</button></td></tr>)}</tbody></table></div>
      <h2 style={{ marginTop: 20 }}>Lotes y vencimientos</h2>
      <div className="c tw" style={{ padding: 0 }}>{d.l.length ? <table><thead><tr><th>Producto</th><th>Lote</th><th>Almacén</th><th>Vence</th><th>Estado</th><th className="r">Disponible</th></tr></thead>
        <tbody>{d.l.map((l: any) => { const n = daysLeft(l.expires_on); return <tr key={l.id}><td>{l.products?.name}</td><td>{l.ref}</td><td>{l.warehouses?.name}</td><td>{fdate(l.expires_on)}</td><td>{n == null ? <Tag k="anu">Sin fecha</Tag> : n < 0 ? <Tag k="low">Vencido</Tag> : n <= 90 ? <Tag k="warn">Vence en {n} d</Tag> : <Tag k="good">Vigente</Tag>}</td><td className="r">{l.qty}</td></tr>; })}</tbody></table> : <Empty>Sin lotes registrados</Empty>}</div>
      {m && <Modal title={(m.t === 'adj' ? 'Ajustar stock · ' : 'Transferir · ') + m.p.name} onClose={() => setM(null)}>
        <label>{m.t === 'adj' ? 'Almacén' : 'Desde'}<select value={m.w} onChange={(e) => setM({ ...m, w: e.target.value, n: m.t === 'adj' ? q(m.p, e.target.value) : m.n })}>{d.w.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({q(m.p, w.id)})</option>)}</select></label>
        {m.t === 'tr' && <label>Hacia<select value={m.to} onChange={(e) => setM({ ...m, to: e.target.value })}>{d.w.filter((w: any) => w.id !== m.w).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
        <label>{m.t === 'adj' ? 'Nuevo stock físico contado' : 'Cantidad'}<input type="number" min={0} value={m.n} onChange={(e) => setM({ ...m, n: e.target.value })} /></label>
        {m.t === 'adj' && <label>Motivo<input value={m.note || ''} onChange={(e) => setM({ ...m, note: e.target.value })} /></label>}
        <div className="bar" style={{ justifyContent: 'flex-end' }}><button className="s" onClick={() => setM(null)}>Cancelar</button><button className="b" onClick={go}>Aplicar</button></div></Modal>}
    </>
  );
}
