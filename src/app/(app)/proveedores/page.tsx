'use client';
import { Crud, useMe } from '@/lib/ui';
export default function P() {
  const me = useMe();
  return <Crud table="suppliers" title="Proveedores" canDelete={me.role === 'admin'} fields={[{ k: 'name', l: 'Razón social' }, { k: 'ruc', l: 'RUC' }, { k: 'contact', l: 'Contacto' }, { k: 'phone', l: 'Teléfono' }, { k: 'email', l: 'Email' }]}
    cols={[{ l: 'Razón social', r: (r) => r.name }, { l: 'RUC', r: (r) => r.ruc }, { l: 'Contacto', r: (r) => r.contact }, { l: 'Teléfono', r: (r) => r.phone }, { l: 'Email', r: (r) => r.email }]} />;
}
