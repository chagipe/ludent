'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from './supabase';
import { Modal, Tag, Thumb, Empty, money, fdate, saldo, rpc, toast, useData, useMe, daysLeft } from './ui';

type Line = { product_id: string; name: string; img?: string; qty: number; price?: number; cost?: number; lot_ref?: string; expires_on?: string };

/* ---------- Venta / Compra ---------- */
export function Doc({ kind }: { kind: 'sale' | 'purchase' }) {
  const s = kind === 'sale', router = useRouter();
  const [data] = useData(async () => {
    const [p, w, par] = await Promise.all([
      sb.from('products').select('id,sku,barcode,name,image_url,cost,price,price_wholesale,product_stock(warehouse_id,qty)').order('name'),
      sb.from('warehouses').select('*').order('name'),
      sb.from(s ? 'customers' : 'suppliers').select('*').order('name'),
    ]);
    return { products: p.data || [], wh: w.data || [], parties: par.data || [] };
  }, [kind]);
  const [party, setParty] = useState(''); const [wh, setWh] = useState(''); const [dtype, setDtype] = useState('Boleta'); const [pay, setPay] = useState('Efectivo');
  const [cond, setCond] = useState('Contado'); const [days, setDays] = useState(30); const [lines, setLines] = useState<Line[]>([]);
  const [pid, setPid] = useState(''); const [qty, setQty] = useState(1); const [unit, setUnit] = useState(''); const [lot, setLot] = useState(''); const [exp, setExp] = useState('');
  const [quoteId, setQuoteId] = useState(''); const [orderId, setOrderId] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('prefill'); if (!raw) return;
    const p = JSON.parse(raw); if (p.kind !== kind) return; sessionStorage.removeItem('prefill');
    setParty(p.party || ''); setLines(p.lines || []); setQuoteId(p.quote_id || ''); setOrderId(p.order_id || '');
  }, [kind]);
  useEffect(() => { if (data && !wh) setWh((data.wh.find((x: any) => x.is_default) || data.wh[0])?.id || ''); }, [data, wh]);
  if (!data) return <Empty>Cargando…</Empty>;

  const cust = s ? data.parties.find((c: any) => c.id === party) : null;
  const price = (p: any) => { const b = cust?.price_list === 'Mayorista' && p.price_wholesale ? p.price_wholesale : p.price; return +(b * (1 - (cust?.discount || 0) / 100)).toFixed(2); };
  const stockOf = (p: any) => p.product_stock?.find((x: any) => x.warehouse_id === wh)?.qty || 0;
  const pick = (id: string) => { setPid(id); const p = data.products.find((x: any) => x.id === id); setUnit(p ? String(s ? price(p) : p.cost) : ''); };
  function add(id = pid, q = qty, u = unit) {
    const p = data.products.find((x: any) => x.id === id); if (!p || q <= 0) return toast('Selecciona producto y cantidad');
    const used = lines.filter((l) => l.product_id === id).reduce((a, l) => a + l.qty, 0);
    if (s && used + q > stockOf(p)) return toast('Stock insuficiente en este almacén. Disponible: ' + (stockOf(p) - used));
    const v = u === '' ? (s ? price(p) : p.cost) : +u;
    setLines([...lines, s ? { product_id: id, name: p.name, img: p.image_url, qty: q, price: v } : { product_id: id, name: p.name, img: p.image_url, qty: q, cost: v, lot_ref: lot, expires_on: exp }]);
    setPid(''); setQty(1); setUnit(''); setLot(''); setExp('');
  }
  function scan(v: string) {
    v = v.trim(); if (!v) return; const p = data.products.find((x: any) => x.barcode === v || x.sku === v);
    p ? add(p.id, 1, '') : toast('Código no encontrado: ' + v);
  }
  const sub = lines.reduce((a, l) => a + l.qty * (s ? l.price! : l.cost!), 0);
  const items = () => lines.map((l) => s ? { product_id: l.product_id, qty: l.qty, price: l.price } : { product_id: l.product_id, qty: l.qty, cost: l.cost, lot_ref: l.lot_ref || '', expires_on: l.expires_on || '' });

  async function confirm() {
    setBusy(true);
    try {
      if (s) {
        await rpc('create_sale', { p_customer: party || null, p_warehouse: wh, p_doc_type: dtype, p_pay: pay, p_due_days: days, p_items: items() });
        if (quoteId) await sb.from('quotes').update({ status: 'convertida' }).eq('id', quoteId);
        toast('Venta registrada'); router.push('/ventas');
      } else {
        await rpc('create_purchase', { p_supplier: party || null, p_warehouse: wh, p_cond: cond, p_due_days: days, p_items: items(), p_order: orderId || null });
        toast('Compra registrada'); router.push('/compras?tab=hist');
      }
    } catch {} finally { setBusy(false); }
  }
  async function saveAs() {
    if (!lines.length) return toast('Agrega productos');
    const total = +(sub * 1.18).toFixed(2), name = data.parties.find((c: any) => c.id === party)?.name;
    if (!s && !party) return toast('Selecciona un proveedor');
    const number = await rpc('next_number', { s: s ? 'COT' : 'OC' });
    const { error } = s
      ? await sb.from('quotes').insert({ number, customer_id: party || null, customer_name: name || 'Cliente general', items: lines, total, valid_until: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10) })
      : await sb.from('purchase_orders').insert({ number, supplier_id: party, supplier_name: name, items: lines, total });
    if (error) return toast(error.message);
    toast('Guardado'); router.push(s ? '/cotizaciones' : '/ordenes');
  }
  const need = s ? ['Efectivo', 'Yape / Plin', 'Transferencia', 'Tarjeta', 'Crédito'] : [];
  const credit = s ? pay === 'Crédito' : cond === 'Crédito';
  return (
    <>
      <h2>{s ? 'Nueva venta' : 'Registrar compra a proveedor'}</h2>
      <div className="c">
        <div className="bar">
          <select value={party} onChange={(e) => setParty(e.target.value)}><option value="">{s ? 'Cliente general' : '— Proveedor —'}</option>{data.parties.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={wh} onChange={(e) => setWh(e.target.value)}>{data.wh.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          {s && <select value={dtype} onChange={(e) => setDtype(e.target.value)}><option>Boleta</option><option>Factura</option></select>}
          {s ? <select value={pay} onChange={(e) => setPay(e.target.value)}>{need.map((m) => <option key={m}>{m}</option>)}</select> : <select value={cond} onChange={(e) => setCond(e.target.value)}><option>Contado</option><option>Crédito</option></select>}
          {credit && <input type="number" min={1} value={days} onChange={(e) => setDays(+e.target.value || 30)} style={{ width: 90 }} title="Días de crédito" />}
        </div>
        <div className="bar">
          <input placeholder="Escanear código…" style={{ width: 150 }} onKeyDown={(e) => { if (e.key === 'Enter') { scan((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
          <select value={pid} onChange={(e) => pick(e.target.value)} style={{ flex: 1, minWidth: 200 }}><option value="">Producto…</option>{data.products.map((p: any) => <option key={p.id} value={p.id}>{p.sku} · {p.name} (stock {stockOf(p)})</option>)}</select>
          {pid && <Thumb url={data.products.find((x: any) => x.id === pid)?.image_url} name={data.products.find((x: any) => x.id === pid)?.name} size={44} />}
          <input type="number" min={1} value={qty} onChange={(e) => setQty(+e.target.value)} style={{ width: 80 }} title="Cantidad" />
          <input type="number" step="0.01" min={0} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={s ? 'Precio' : 'Costo'} style={{ width: 100 }} />
          {!s && <><input placeholder="N° lote" value={lot} onChange={(e) => setLot(e.target.value)} style={{ width: 100 }} /><input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></>}
          <button className="b" onClick={() => add()}>Agregar</button>
        </div>
        <div className="tw">{lines.length ? (
          <table><thead><tr><th>Producto</th>{!s && <><th>Lote</th><th>Vence</th></>}<th className="r">Cant.</th><th className="r">{s ? 'Precio' : 'Costo'}</th><th className="r">Importe</th><th /></tr></thead>
            <tbody>{lines.map((l, i) => <tr key={i}><td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Thumb url={l.img} name={l.name} size={32} />{l.name}</div></td>{!s && <><td>{l.lot_ref || '—'}</td><td>{fdate(l.expires_on)}</td></>}<td className="r">{l.qty}</td><td className="r">{money(s ? l.price : l.cost)}</td><td className="r">{money(l.qty * (s ? l.price! : l.cost!))}</td><td className="r"><button className="s" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Quitar</button></td></tr>)}</tbody></table>
        ) : <Empty>Agrega productos al detalle</Empty>}</div>
      </div>
      <div className="c" style={{ maxWidth: 360, marginLeft: 'auto' }}>
        <div className="lg"><span>Subtotal</span><span>{money(sub)}</span></div><div className="lg"><span>IGV (18%)</span><span>{money(sub * 0.18)}</span></div>
        <div className="lg" style={{ margin: '6px 0 12px' }}><b>Total</b><b style={{ fontSize: 20 }}>{money(sub * 1.18)}</b></div>
        <button className="b" style={{ width: '100%' }} disabled={busy} onClick={confirm}>{s ? 'Confirmar venta y descontar stock' : 'Confirmar compra y sumar stock'}</button>
        <button className="s" style={{ width: '100%', marginTop: 8 }} onClick={saveAs}>{s ? 'Guardar como cotización' : 'Guardar como orden de compra'}</button>
      </div>
    </>
  );
}

/* ---------- Comprobante imprimible ---------- */
export function Comprobante({ d, onClose }: { d: any; onClose: () => void }) {
  const [co] = useData(async () => (await sb.from('company').select('*').single()).data);
  const [items] = useData(async () => d.items || (await sb.from('sale_items').select('*').eq('sale_id', d.id)).data || [], [d.id]);
  const title = d.doc_type === 'Factura' ? 'FACTURA ELECTRÓNICA' : d.doc_type ? 'BOLETA DE VENTA ELECTRÓNICA' : d.sale_number ? 'NOTA DE CRÉDITO ELECTRÓNICA' : 'COTIZACIÓN';
  return (
    <Modal title="" onClose={onClose} wide>
      <div className="print">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><b style={{ fontSize: 16 }}>{co?.name}</b><br />RUC {co?.ruc || '—'}<br />{co?.address}</div>
          <div style={{ border: '2px solid #111', padding: 10, textAlign: 'center' }}><b>{title}</b><br />{d.number}</div>
        </div>
        <p>Fecha: {new Date(d.created_at).toLocaleString('es-PE')}<br />Cliente: {d.customer_name}{d.pay_method ? <><br />Pago: {d.pay_method}</> : null}{d.sale_number ? <><br />Referencia: {d.sale_number}</> : null}{d.status === 'anulada' ? ' · ANULADO' : ''}</p>
        <table><thead><tr><th>Cant.</th><th>Descripción</th><th className="r">P. unit.</th><th className="r">Importe</th></tr></thead>
          <tbody>{(items || []).map((i: any, n: number) => <tr key={n}><td>{i.qty}</td><td>{i.name}</td><td className="r">{money(i.price)}</td><td className="r">{money(i.qty * i.price)}</td></tr>)}</tbody></table>
        <p style={{ textAlign: 'right' }}>Subtotal {money(d.subtotal ?? d.total / 1.18)}<br />IGV 18% {money(d.igv ?? d.total - d.total / 1.18)}<br /><b>Total {money(d.total)}</b></p>
        <p style={{ color: '#666', fontSize: 11 }}>Representación interna. Documento aún no enviado a SUNAT.</p>
      </div>
      <div className="bar" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="s" onClick={onClose}>Cerrar</button><button className="b" onClick={() => window.print()}>Imprimir</button></div>
    </Modal>
  );
}

/* ---------- Historial de ventas / compras / notas de crédito ---------- */
export function History({ kind }: { kind: 'sales' | 'purchases' }) {
  const me = useMe(); const [tab, setTab] = useState<string>(kind);
  const [rows, reload] = useData(async () => (await sb.from(tab).select('*').order('created_at', { ascending: false }).limit(300)).data || [], [tab]);
  const [view, setView] = useState<any>(null); const [ret, setRet] = useState<any>(null);
  async function anular(d: any) { if (!confirm('¿Anular ' + d.number + '? Se revertirá el stock.')) return; try { await rpc(kind === 'sales' ? 'void_sale' : 'void_purchase', { p_id: d.id }); toast('Documento anulado'); reload(); } catch {} }
  async function openRet(d: any) { const { data } = await sb.from('sale_items').select('*').eq('sale_id', d.id); setRet({ d, items: data || [], q: {}, reason: '' }); }
  async function doRet() {
    const items = Object.entries(ret.q).filter(([, v]: any) => +v > 0).map(([k, v]: any) => ({ sale_item_id: k, qty: +v }));
    if (!items.length) return toast('Indica las cantidades a devolver');
    try { await rpc('create_credit_note', { p_sale: ret.d.id, p_items: items, p_reason: ret.reason }); toast('Nota de crédito emitida'); setRet(null); setTab('credit_notes'); } catch {}
  }
  return (
    <>
      <h2>Historial</h2>
      {kind === 'sales' && <div className="tt"><button className={tab === 'sales' ? 'b' : 's'} onClick={() => setTab('sales')}>Ventas</button><button className={tab === 'credit_notes' ? 'b' : 's'} onClick={() => setTab('credit_notes')}>Notas de crédito</button></div>}
      <div className="c tw" style={{ padding: 0 }}>{(rows || []).length ? (
        <table><thead><tr><th>N°</th><th>Fecha</th><th>{tab === 'purchases' ? 'Proveedor' : 'Cliente'}</th><th className="r">Total</th><th>Estado</th><th /></tr></thead>
          <tbody>{rows!.map((d: any) => <tr key={d.id}><td>{d.number}</td><td>{fdate(d.created_at)}</td><td>{d.customer_name || d.supplier_name}</td><td className="r">{money(d.total)}</td>
            <td>{tab === 'credit_notes' ? <Tag k="good">Emitida</Tag> : d.status === 'ok' ? <Tag k={saldo(d) > 0.005 ? 'warn' : 'good'}>{saldo(d) > 0.005 ? 'Con saldo' : tab === 'sales' ? 'Pagada' : 'Recibida'}</Tag> : <Tag k="anu">Anulada</Tag>}</td>
            <td className="r">{tab !== 'purchases' && <button className="s" onClick={() => setView(d)}>Comprobante</button>} {tab === 'sales' && d.status === 'ok' && <button className="s" onClick={() => openRet(d)}>Devolver</button>} {tab !== 'credit_notes' && d.status === 'ok' && me.role === 'admin' && <button className="s d" onClick={() => anular(d)}>Anular</button>}</td></tr>)}</tbody></table>
      ) : <Empty>Sin movimientos</Empty>}</div>
      {view && <Comprobante d={view} onClose={() => setView(null)} />}
      {ret && <Modal title={'Devolución · ' + ret.d.number} onClose={() => setRet(null)}>
        {ret.items.map((i: any) => <label key={i.id}>{i.name} (vendidas {i.qty}, devueltas {i.returned})<input type="number" min={0} max={i.qty - i.returned} value={ret.q[i.id] || 0} onChange={(e) => setRet({ ...ret, q: { ...ret.q, [i.id]: e.target.value } })} /></label>)}
        <label>Motivo<input value={ret.reason} onChange={(e) => setRet({ ...ret, reason: e.target.value })} /></label>
        <div className="bar" style={{ justifyContent: 'flex-end' }}><button className="s" onClick={() => setRet(null)}>Cancelar</button><button className="b" onClick={doRet}>Emitir nota de crédito</button></div></Modal>}
    </>
  );
}

/* ---------- Cuentas por cobrar / pagar ---------- */
export function Receivables({ kind }: { kind: 'sale' | 'purchase' }) {
  const t = kind === 'sale' ? 'sales' : 'purchases';
  const [rows, reload] = useData(async () => ((await sb.from(t).select('*').eq('status', 'ok')).data || []).filter((d: any) => saldo(d) > 0.005).sort((a: any, b: any) => (a.due_on || '9').localeCompare(b.due_on || '9')), [t]);
  const [p, setP] = useState<any>(null);
  const sum = (l: any[]) => l.reduce((a, d) => a + saldo(d), 0);
  async function pay() { try { await rpc('register_payment', { p_kind: kind, p_doc: p.d.id, p_amount: +p.amt, p_method: p.m }); toast('Registrado'); setP(null); reload(); } catch {} }
  return (
    <>
      <h2>{kind === 'sale' ? 'Cuentas por cobrar' : 'Cuentas por pagar'}</h2>
      <div className="g"><div className="c"><div className="k">Saldo pendiente</div><div className="v">{money(sum(rows || []))}</div></div><div className="c"><div className="k">Vencido</div><div className="v" style={{ color: 'var(--dg)' }}>{money(sum((rows || []).filter((d: any) => (daysLeft(d.due_on) ?? 0) < 0)))}</div></div></div>
      <div className="c tw" style={{ padding: 0 }}>{(rows || []).length ? (
        <table><thead><tr><th>Documento</th><th>{kind === 'sale' ? 'Cliente' : 'Proveedor'}</th><th>Vence</th><th>Estado</th><th className="r">Total</th><th className="r">Saldo</th><th /></tr></thead>
          <tbody>{rows!.map((d: any) => { const n = daysLeft(d.due_on); return <tr key={d.id}><td>{d.number}</td><td>{d.customer_name || d.supplier_name}</td><td>{fdate(d.due_on)}</td><td>{n == null ? <Tag k="anu">Sin fecha</Tag> : n < 0 ? <Tag k="low">Vencido</Tag> : <Tag k={n <= 7 ? 'warn' : 'good'}>Vence en {n} d</Tag>}</td><td className="r">{money(d.total)}</td><td className="r"><b>{money(saldo(d))}</b></td><td className="r"><button className="b" onClick={() => setP({ d, amt: saldo(d).toFixed(2), m: 'Efectivo' })}>{kind === 'sale' ? 'Registrar cobro' : 'Registrar pago'}</button></td></tr>; })}</tbody></table>
      ) : <Empty>No hay saldos pendientes</Empty>}</div>
      {p && <Modal title={p.d.number} onClose={() => setP(null)}>
        <label>Saldo: {money(saldo(p.d))}. Monto<input type="number" step="0.01" value={p.amt} onChange={(e) => setP({ ...p, amt: e.target.value })} /></label>
        <label>Medio<select value={p.m} onChange={(e) => setP({ ...p, m: e.target.value })}>{['Efectivo', 'Yape / Plin', 'Transferencia', 'Tarjeta'].map((m) => <option key={m}>{m}</option>)}</select></label>
        <div className="bar" style={{ justifyContent: 'flex-end' }}><button className="s" onClick={() => setP(null)}>Cancelar</button><button className="b" onClick={pay}>Registrar</button></div></Modal>}
    </>
  );
}
