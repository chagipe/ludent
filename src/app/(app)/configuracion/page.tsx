'use client';
import { useState } from 'react';
import { sb } from '@/lib/supabase';
import { toast, useData, useMe, Empty } from '@/lib/ui';

export default function Config() {
  const me = useMe(); const [co, setCo] = useState<any>(null);
  const [d, reload] = useData(async () => { const [c, u] = await Promise.all([sb.from('company').select('*').single(), sb.from('profiles').select('*').order('created_at')]); setCo(c.data); return { u: u.data || [] }; });
  if (!d || !co) return <Empty>Cargando…</Empty>;
  async function save() { const { error } = await sb.from('company').update({ name: co.name, ruc: co.ruc, address: co.address, serie_boleta: co.serie_boleta, serie_factura: co.serie_factura }).eq('id', 1); toast(error ? error.message : 'Guardado'); }
  async function role(id: string, r: string) { const { error } = await sb.from('profiles').update({ role: r }).eq('id', id); if (error) toast(error.message); reload(); }
  const F = [['name', 'Razón social'], ['ruc', 'RUC'], ['address', 'Dirección'], ['serie_boleta', 'Serie boleta'], ['serie_factura', 'Serie factura']];
  return (
    <>
      <h2>Configuración</h2>
      <div className="c"><h3>Datos de la empresa</h3><div className="two">{F.map(([k, l]) => <label className="lbl" key={k}>{l}<input style={{ width: '100%' }} value={co[k] || ''} onChange={(e) => setCo({ ...co, [k]: e.target.value })} /></label>)}</div><button className="b" onClick={save}>Guardar</button></div>
      <div className="c tw" style={{ padding: 0 }}><h3 style={{ padding: '14px 14px 0' }}>Usuarios y roles</h3>
        <table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead><tbody>{d.u.map((u: any) => <tr key={u.id}><td>{u.full_name}{u.id === me.id ? ' (tú)' : ''}</td><td>{u.email}</td>
          <td><select value={u.role} disabled={u.id === me.id} onChange={(e) => role(u.id, e.target.value)}>{['admin', 'vendedor', 'almacen', 'pendiente'].map((r) => <option key={r}>{r}</option>)}</select></td></tr>)}</tbody></table></div>
    </>
  );
}
