'use client';
import { useState } from 'react';
import { sb } from '@/lib/supabase';
import { Crud, Modal, Tag, Thumb, money, fdate, rpc, toast, useData, useMe, Empty } from '@/lib/ui';

export default function Productos() {
  const me = useMe(); const [hist, setHist] = useState<any>(null); const [kdx, setKdx] = useState<any>(null); const [ing, setIng] = useState<any>(null); const [tick, setTick] = useState(0);
  const [wh] = useData(async () => (await sb.from('warehouses').select('id,name,is_default').order('name')).data || []);
  async function openKdx(p: any) { const [m, u] = await Promise.all([sb.from('stock_movements').select('*,warehouses(name)').eq('product_id', p.id).order('created_at', { ascending: false }).limit(200), sb.from('profiles').select('id,full_name')]); setKdx({ p, rows: m.data || [], u: Object.fromEntries((u.data || []).map((x: any) => [x.id, x.full_name])) }); }
  async function doIng() { try { await rpc('receive_stock', { p_product: ing.p.id, p_warehouse: ing.w, p_qty: +ing.qty, p_lot_ref: ing.lot || null, p_expires_on: ing.exp || null, p_note: ing.note || null }); toast('Stock ingresado'); setIng(null); setTick(tick + 1); } catch {} }
  const [sup] = useData(async () => (await sb.from('suppliers').select('id,name').order('name')).data || []);
  async function openHist(p: any) { const { data } = await sb.from('price_history').select('*').eq('product_id', p.id).order('created_at', { ascending: false }); setHist({ p, rows: data || [] }); }
  if (!sup) return <Empty>Cargando…</Empty>;
  const stock = (r: any) => (r.product_stock || []).reduce((a: number, x: any) => a + x.qty, 0);
  return (
    <>
      <Crud key={tick} table="products" title="Productos" order="name" select="*,product_stock(qty),suppliers(name)" can={me.role !== 'vendedor'} canDelete={me.role === 'admin'}
        fields={[
          { k: 'image_url', l: 'Imagen', t: 'image' }, { k: 'sku', l: 'SKU' }, { k: 'barcode', l: 'Código de barras' }, { k: 'name', l: 'Nombre' }, { k: 'category', l: 'Categoría' },
          { k: 'supplier_id', l: 'Proveedor', t: 'select', opts: sup.map((s: any) => ({ v: s.id, l: s.name })) },
          { k: 'cost', l: 'Costo (S/)', t: 'number' }, { k: 'price', l: 'Precio venta (S/)', t: 'number' }, { k: 'price_wholesale', l: 'Precio mayorista (S/)', t: 'number' }, { k: 'min_stock', l: 'Stock mínimo', t: 'number' },
        ]}
        cols={[
          { l: 'Imagen', r: (r) => <Thumb url={r.image_url} name={r.name} /> }, { l: 'SKU', r: (r) => r.sku }, { l: 'Producto', r: (r) => r.name }, { l: 'Categoría', r: (r) => r.category }, { l: 'Proveedor', r: (r) => r.suppliers?.name || '—' },
          { l: 'Stock', right: true, r: (r) => <Tag k={stock(r) <= r.min_stock ? 'low' : 'good'}>{stock(r)}</Tag> },
          { l: 'Costo', right: true, r: (r) => money(r.cost) }, { l: 'Precio', right: true, r: (r) => money(r.price) },
          { l: 'Margen', right: true, r: (r) => (r.price ? Math.round(((r.price - r.cost) / r.price) * 100) : 0) + '%' },
        ]}
        extra={(r) => <>{me.role !== 'vendedor' && <button className="b" onClick={() => setIng({ p: r, w: wh?.find((x: any) => x.is_default)?.id || wh?.[0]?.id, qty: 1 })}>Ingresar stock</button>} <button className="s" onClick={() => openKdx(r)}>Kardex</button> <button className="s" onClick={() => openHist(r)}>Precios</button></>}
      />
      {ing && <Modal title={'Ingresar stock · ' + ing.p.name} onClose={() => setIng(null)}>
        <p className="mu" style={{ marginTop: 0 }}>Suma unidades al stock actual (no lo reemplaza). Queda registrado en el kardex y en los reportes.</p>
        <label>Almacén<select value={ing.w} onChange={(e) => setIng({ ...ing, w: e.target.value })}>{wh?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label>Cantidad a ingresar<input type="number" min={1} value={ing.qty} onChange={(e) => setIng({ ...ing, qty: e.target.value })} /></label>
        <div className="two"><label>N° de lote (opcional)<input value={ing.lot || ''} onChange={(e) => setIng({ ...ing, lot: e.target.value })} /></label><label>Vencimiento (opcional)<input type="date" value={ing.exp || ''} onChange={(e) => setIng({ ...ing, exp: e.target.value })} /></label></div>
        <label>Motivo o documento de referencia<input value={ing.note || ''} onChange={(e) => setIng({ ...ing, note: e.target.value })} placeholder="Ej.: guía 0123, donación, reposición" /></label>
        <div className="bar" style={{ justifyContent: 'flex-end' }}><button className="s" onClick={() => setIng(null)}>Cancelar</button><button className="b" onClick={doIng}>Ingresar</button></div></Modal>}
      {kdx && <Modal title={'Kardex · ' + kdx.p.name} onClose={() => setKdx(null)} wide>
        <div className="tw"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Almacén</th><th className="r">Cantidad</th><th>Usuario</th><th>Detalle</th></tr></thead>
          <tbody>{kdx.rows.map((m: any) => <tr key={m.id}><td>{new Date(m.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{m.kind}</td><td>{m.warehouses?.name}</td><td className="r"><b style={{ color: m.qty > 0 ? 'var(--ok)' : 'var(--dg)' }}>{m.qty > 0 ? '+' : ''}{m.qty}</b></td><td>{kdx.u[m.created_by] || '—'}</td><td className="mu">{m.note || ''}</td></tr>)}</tbody></table></div>
        <div className="bar" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="s" onClick={() => setKdx(null)}>Cerrar</button></div></Modal>}
      {hist && <Modal title={'Historial de precios · ' + hist.p.name} onClose={() => setHist(null)} wide>
        <div className="tw"><table><thead><tr><th>Fecha</th><th className="r">Costo</th><th className="r">Precio</th><th>Origen</th></tr></thead>
          <tbody>{hist.rows.map((h: any) => <tr key={h.id}><td>{fdate(h.created_at)}</td><td className="r">{money(h.cost)}</td><td className="r">{money(h.price)}</td><td>{h.source}</td></tr>)}</tbody></table></div>
        <div className="bar" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="s" onClick={() => setHist(null)}>Cerrar</button></div></Modal>}
    </>
  );
}
