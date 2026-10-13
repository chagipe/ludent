'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { Me } from '@/lib/ui';

const A = ['admin'], AV = ['admin', 'vendedor'], AA = ['admin', 'almacen'], ALL = ['admin', 'vendedor', 'almacen'];
const NAV: [string, string?, string[]?][] = [
  ['Principal'], ['/', 'Inicio', ALL],
  ['Inventario'], ['/productos', 'Productos', ALL], ['/almacenes', 'Almacenes y stock', AA], ['/reposicion', 'Reposición', AA], ['/ordenes', 'Órdenes de compra', AA], ['/compras', 'Compras', AA], ['/por-pagar', 'Por pagar', A],
  ['Ventas'], ['/ventas/nueva', 'Nueva venta', AV], ['/campo', 'Pedido en campo', AV], ['/cotizaciones', 'Cotizaciones', AV], ['/ventas', 'Historial', AV], ['/por-cobrar', 'Por cobrar', AV],
  ['Contactos'], ['/proveedores', 'Proveedores', AA], ['/clientes', 'Clientes', AV],
  ['Sistema'], ['/reportes', 'Reportes', A], ['/configuracion', 'Configuración', A],
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const [me, setMe] = useState<any>(null);
  useEffect(() => { (async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb.from('profiles').select('role,full_name').eq('id', user.id).single();
    setMe({ id: user.id, role: data?.role || 'pendiente', name: data?.full_name || user.email });
  })(); }, []);
  if (!me) return <div className="em">Cargando…</div>;
  if (me.role === 'pendiente') return <div className="login"><h2>Acceso pendiente</h2><p className="mu">Tu cuenta fue creada. Pide al administrador que te asigne un rol.</p><button className="s" onClick={async () => { await sb.auth.signOut(); location.href = '/login'; }}>Salir</button></div>;
  const items = NAV.filter(([, l, r]) => !l || r!.includes(me.role));
  const allowed = NAV.find(([h, l, r]) => l && (h === path || (h !== '/' && path.startsWith(h + '/'))) && !r!.includes(me.role));
  return (
    <Me.Provider value={me}>
      <div className="shell">
        <nav><h1>LU<span>DENT</span></h1>
          {items.map(([h, l]) => l ? <Link key={h} href={h} className={path === h ? 'on' : ''}>{l}</Link> : <small key={h}>{h}</small>)}
        </nav>
        <div className="app">
          <div className="top"><span className="u">{me.name} · {me.role}</span><button className="s" onClick={async () => { await sb.auth.signOut(); location.href = '/login'; }}>Salir</button></div>
          <main>{allowed ? <div className="em">No tienes acceso a esta sección.</div> : children}</main>
        </div>
      </div>
    </Me.Provider>
  );
}
