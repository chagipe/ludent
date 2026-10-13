'use client';
import { useState } from 'react';
import { sb } from '@/lib/supabase';
import { Crud, Modal, Tag, money, fdate, useData, useMe, Empty } from '@/lib/ui';

export default function Productos() {
  const me = useMe(); const [hist, setHist] = useState<any>(null);
  const [sup] = useData(async () => (await sb.from('suppliers').select('id,name').order('name')).data || []);
  async function openHist(p: any) { const { data } = await sb.from('price_history').select('*').eq('product_id', p.id).order('created_at', { ascending: false }); setHist({ p, rows: data || [] }); }
  if (!sup) return <Empty>Cargando…</Empty>;
  const stock = (r: any) => (r.product_stock || []).reduce((a: number, x: any) => a + x.qty, 0);
  return (
    <>
      <Crud table="products" title="Productos" order="name" select="*,product_stock(qty),suppliers(name)" can={me.role !== 'vendedor'} canDelete={me.role === 'admin'}
        fields={[
          { k: 'sku', l: 'SKU' }, { k: 'barcode', l: 'Código de barras' }, { k: 'name', l: 'Nombre' }, { k: 'category', l: 'Categoría' },
          { k: 'supplier_id', l: 'Proveedor', t: 'select', opts: sup.map((s: any) => ({ v: s.id, l: s.name })) },
          { k: 'cost', l: 'Costo (S/)', t: 'number' }, { k: 'price', l: 'Precio venta (S/)', t: 'number' }, { k: 'price_wholesale', l: 'Precio mayorista (S/)', t: 'number' }, { k: 'min_stock', l: 'Stock mínimo', t: 'number' },
        ]}
        cols={[
          { l: 'SKU', r: (r) => r.sku }, { l: 'Producto', r: (r) => r.name }, { l: 'Categoría', r: (r) => r.category }, { l: 'Proveedor', r: (r) => r.suppliers?.name || '—' },
          { l: 'Stock', right: true, r: (r) => <Tag k={stock(r) <= r.min_stock ? 'low' : 'good'}>{stock(r)}</Tag> },
          { l: 'Costo', right: true, r: (r) => money(r.cost) }, { l: 'Precio', right: true, r: (r) => money(r.price) },
          { l: 'Margen', right: true, r: (r) => (r.price ? Math.round(((r.price - r.cost) / r.price) * 100) : 0) + '%' },
        ]}
        extra={(r) => <button className="s" onClick={() => openHist(r)}>Precios</button>}
      />
      {hist && <Modal title={'Historial de precios · ' + hist.p.name} onClose={() => setHist(null)} wide>
        <div className="tw"><table><thead><tr><th>Fecha</th><th className="r">Costo</th><th className="r">Precio</th><th>Origen</th></tr></thead>
          <tbody>{hist.rows.map((h: any) => <tr key={h.id}><td>{fdate(h.created_at)}</td><td className="r">{money(h.cost)}</td><td className="r">{money(h.price)}</td><td>{h.source}</td></tr>)}</tbody></table></div>
        <div className="bar" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="s" onClick={() => setHist(null)}>Cerrar</button></div></Modal>}
    </>
  );
}
