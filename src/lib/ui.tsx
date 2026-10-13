'use client';
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { sb } from './supabase';

export const money = (n: any) => 'S/ ' + (+n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fdate = (d?: string) => (d ? new Date(d.length === 10 ? d + 'T00:00' : d).toLocaleDateString('es-PE') : '—');
export const daysLeft = (d?: string) => (d ? Math.round((new Date(d + 'T00:00').getTime() - Date.now()) / 864e5) : null);
export const saldo = (d: any) => (d.total || 0) - (d.credited || 0) - (d.paid || 0);

export function toast(m: string) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = m;
  document.body.appendChild(d); setTimeout(() => d.remove(), 3500);
}
export async function rpc(name: string, args: any) {
  const { data, error } = await sb.rpc(name, args);
  if (error) { toast(error.message); throw error; }
  return data;
}
export function useData<T = any>(loader: () => PromiseLike<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const reload = useCallback(() => { Promise.resolve(loader()).then(setData); }, deps); // eslint-disable-line
  useEffect(reload, [reload]);
  return [data, reload] as const;
}
export const Me = createContext<{ id: string; role: string; name: string } | null>(null);
export const useMe = () => useContext(Me)!;

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="md" style={wide ? { width: 680 } : undefined}>
        <h3>{title}</h3>{children}
      </div>
    </div>
  );
}
export function Thumb({ url, name, size = 40 }: { url?: string | null; name?: string; size?: number }) {
  const [big, setBig] = useState(false);
  const box: any = { width: size, height: size, borderRadius: 8, flexShrink: 0, objectFit: 'cover', border: '1px solid var(--bd)', background: 'var(--hv)' };
  if (!url) return <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)', fontSize: size * 0.38, fontWeight: 700 }}>{(name || '?').trim().slice(0, 2).toUpperCase()}</div>;
  return (<>
    <img src={url} alt={name} loading="lazy" style={{ ...box, cursor: 'zoom-in' }} onClick={() => setBig(true)} />
    {big && <div className="ov" onClick={() => setBig(false)}><img src={url} alt={name} style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 12, background: '#fff' }} /></div>}
  </>);
}
export async function uploadProductImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file), sc = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
  const cx = cv.getContext('2d')!; cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob: Blob = await new Promise((res) => cv.toBlob((b) => res(b!), 'image/jpeg', 0.82));
  const path = crypto.randomUUID() + '.jpg';
  const { error } = await sb.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) { toast(error.message); throw error; }
  return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
export const Tag = ({ k, children }: { k: 'good' | 'warn' | 'low' | 'anu'; children: ReactNode }) => <span className={'tag ' + k}>{children}</span>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="em">{children}</div>;

export type Field = { k: string; l: string; t?: 'text' | 'number' | 'select' | 'image'; opts?: { v: string; l: string }[] };
export function Crud({ table, title, fields, cols, select = '*', order = 'name', can = true, canDelete = false, extra }: {
  table: string; title: string; fields: Field[]; cols: { l: string; r: (row: any) => ReactNode; right?: boolean }[];
  select?: string; order?: string; can?: boolean; canDelete?: boolean; extra?: (row: any) => ReactNode;
}) {
  const [q, setQ] = useState('');
  const [rows, reload] = useData(async () => (await sb.from(table).select(select).order(order)).data || [], [table]);
  const [edit, setEdit] = useState<any>(null);
  const list = (rows || []).filter((r: any) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  async function save() {
    const o: any = {};
    fields.forEach((f) => { const v = edit[f.k]; o[f.k] = f.t === 'number' ? +v || 0 : v === '' ? null : v; });
    const { error } = edit.id ? await sb.from(table).update(o).eq('id', edit.id) : await sb.from(table).insert(o);
    if (error) return toast(error.message);
    setEdit(null); reload(); toast('Guardado');
  }
  async function del(id: string) {
    if (!confirm('¿Eliminar este registro?')) return;
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) return toast('No se puede eliminar: tiene movimientos asociados'); reload();
  }
  return (
    <>
      <h2>{title}</h2>
      <div className="c" style={{ padding: 0 }}>
        <div className="bar" style={{ padding: 14, margin: 0 }}>
          <input type="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
          {can && <button className="b" onClick={() => setEdit({})}>+ Nuevo</button>}
        </div>
        <div className="tw">
          {list.length ? (
            <table><thead><tr>{cols.map((c) => <th key={c.l} className={c.right ? 'r' : ''}>{c.l}</th>)}<th /></tr></thead>
              <tbody>{list.map((r: any) => (
                <tr key={r.id}>{cols.map((c) => <td key={c.l} className={c.right ? 'r' : ''}>{c.r(r)}</td>)}
                  <td className="r">{extra?.(r)} {can && <button className="s" onClick={() => setEdit({ ...r })}>Editar</button>} {canDelete && <button className="s d" onClick={() => del(r.id)}>Eliminar</button>}</td></tr>
              ))}</tbody></table>
          ) : <Empty>Sin registros</Empty>}
        </div>
        <div className="ft">{list.length} registro(s)</div>
      </div>
      {edit && (
        <Modal title={(edit.id ? 'Editar ' : 'Nuevo ') + title.toLowerCase()} onClose={() => setEdit(null)}>
          <div className="two">{fields.map((f) => f.t === 'image' ? (
            <div key={f.k} className="lbl" style={{ gridColumn: '1 / -1' }}>{f.l}
              <div className="bar" style={{ marginTop: 4, marginBottom: 0 }}>
                <Thumb url={edit[f.k]} name={edit.name} size={72} />
                <input type="file" accept="image/*" style={{ flex: 1 }} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const u = await uploadProductImage(file); setEdit((p: any) => ({ ...p, [f.k]: u })); } catch {} }} />
                {edit[f.k] && <button type="button" className="s" onClick={() => setEdit({ ...edit, [f.k]: '' })}>Quitar</button>}
              </div>
              <span className="mu" style={{ fontSize: 11 }}>Sube una foto desde tu dispositivo (se reduce automáticamente).</span>
            </div>
          ) : (
            <label key={f.k}>{f.l}
              {f.t === 'select' ? (
                <select value={edit[f.k] ?? ''} onChange={(e) => setEdit({ ...edit, [f.k]: e.target.value })}><option value="">—</option>{f.opts?.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
              ) : <input type={f.t === 'number' ? 'number' : 'text'} step="0.01" value={edit[f.k] ?? ''} onChange={(e) => setEdit({ ...edit, [f.k]: e.target.value })} />}
            </label>))}</div>
          <div className="bar" style={{ justifyContent: 'flex-end' }}><button className="s" onClick={() => setEdit(null)}>Cancelar</button><button className="b" onClick={save}>Guardar</button></div>
        </Modal>
      )}
    </>
  );
}
