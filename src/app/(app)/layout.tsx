'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { Me } from '@/lib/ui';

const A = ['admin'], AV = ['admin', 'vendedor'], AA = ['admin', 'almacen'], ALL = ['admin', 'vendedor', 'almacen'];
type Item = [string, string, string[]];
const HOME: Item = ['/', 'Inicio', ALL];
const GROUPS: { id: string; label: string; icon: string; items: Item[] }[] = [
  { id: 'inv', label: 'Inventario', icon: 'box', items: [['/productos', 'Productos', ALL], ['/almacenes', 'Almacenes y stock', AA], ['/reposicion', 'Reposición', AA], ['/ordenes', 'Órdenes de compra', AA], ['/compras', 'Compras', AA], ['/por-pagar', 'Por pagar', A]] },
  { id: 'ven', label: 'Ventas', icon: 'cart', items: [['/ventas/nueva', 'Nueva venta', AV], ['/campo', 'Pedido en campo', AV], ['/cotizaciones', 'Cotizaciones', AV], ['/ventas', 'Historial', AV], ['/por-cobrar', 'Por cobrar', AV]] },
  { id: 'con', label: 'Contactos', icon: 'users', items: [['/proveedores', 'Proveedores', AA], ['/clientes', 'Clientes', AV]] },
  { id: 'sis', label: 'Sistema', icon: 'cog', items: [['/reportes', 'Reportes', A], ['/configuracion', 'Configuración', A]] },
];
const ICON: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10', box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', cart: 'M3 4h2l2.5 11h10L20 7H6M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z',
  users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8', cog: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4',
  chev: 'M6 9l6 6 6-6', menu: 'M4 6h16M4 12h16M4 18h16',
};
const Ic = ({ n, s = 20 }: { n: string; s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={n === 'chev' ? 'ch' : ''}><path d={ICON[n]} /></svg>;

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const [me, setMe] = useState<any>(null); const [open, setOpen] = useState(false); const [exp, setExp] = useState<string[]>([]);
  useEffect(() => { (async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb.from('profiles').select('role,full_name').eq('id', user.id).single();
    setMe({ id: user.id, role: data?.role || 'pendiente', name: data?.full_name || user.email });
  })(); }, []);
  useEffect(() => { setOpen(false); const g = GROUPS.find((g) => g.items.some(([h]) => path === h || path.startsWith(h + '/'))); if (g) setExp((e) => (e.includes(g.id) ? e : [...e, g.id])); }, [path]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  if (!me) return <div className="em">Cargando…</div>;
  if (me.role === 'pendiente') return <div className="login"><h2>Acceso pendiente</h2><p className="mu">Tu cuenta fue creada. Pide al administrador que te asigne un rol.</p><button className="s" onClick={async () => { await sb.auth.signOut(); location.href = '/login'; }}>Salir</button></div>;
  const all: Item[] = [HOME, ...GROUPS.flatMap((g) => g.items)];
  const denied = all.find(([h, , r]) => (h === path || (h !== '/' && path.startsWith(h + '/'))) && !r.includes(me.role));
  const current = all.find(([h]) => h === path)?.[1] || '';
  const toggle = (id: string) => setExp((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  return (
    <Me.Provider value={me}>
      <div className="app">
        <div className="top">
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menú"><Ic n="menu" />Menú</button>
          <span className="brand">LU<span>DENT</span></span><b style={{ marginLeft: 6 }}>{current}</b>
          <span className="u">{me.name} · {me.role}</span>
          <button className="s out" onClick={async () => { await sb.auth.signOut(); location.href = '/login'; }}>Salir</button>
        </div>
        <main>{denied ? <div className="em">No tienes acceso a esta sección.</div> : children}</main>
      </div>
      <div className={'bk' + (open ? ' on' : '')} onClick={() => setOpen(false)} />
      <aside className={'dr' + (open ? ' on' : '')}>
        <h1>LU<span>DENT</span></h1>
        <Link href="/" className={path === '/' ? 'on' : ''}><Ic n="home" />Inicio</Link>
        {GROUPS.map((g) => {
          const its = g.items.filter(([, , r]) => r.includes(me.role)); if (!its.length) return null;
          const o = exp.includes(g.id);
          return (
            <div key={g.id}>
              <button className={'gh' + (o ? ' open' : '')} onClick={() => toggle(g.id)}><Ic n={g.icon} />{g.label}<Ic n="chev" s={18} /></button>
              <div className={'sub' + (o ? ' open' : '')}>{its.map(([h, l]) => <Link key={h} href={h} className={path === h ? 'on' : ''}>{l}</Link>)}</div>
            </div>
          );
        })}
      </aside>
    </Me.Provider>
  );
}
