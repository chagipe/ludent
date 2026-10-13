'use client';
import { Crud, useMe } from '@/lib/ui';
export default function P() {
  const me = useMe();
  return <Crud table="customers" title="Clientes" canDelete={me.role === 'admin'} fields={[{ k: 'name', l: 'Nombre / Clínica / Odontólogo' }, { k: 'doc', l: 'RUC / DNI' }, { k: 'phone', l: 'Teléfono' }, { k: 'email', l: 'Email' }, { k: 'address', l: 'Dirección' },
    { k: 'price_list', l: 'Lista de precios', t: 'select', opts: [{ v: 'Minorista', l: 'Minorista' }, { v: 'Mayorista', l: 'Mayorista' }] }, { k: 'discount', l: 'Descuento (%)', t: 'number' }]}
    cols={[{ l: 'Nombre', r: (r) => r.name }, { l: 'RUC / DNI', r: (r) => r.doc }, { l: 'Teléfono', r: (r) => r.phone }, { l: 'Lista', r: (r) => r.price_list }, { l: 'Desc.', right: true, r: (r) => (r.discount || 0) + '%' }]} />;
}
