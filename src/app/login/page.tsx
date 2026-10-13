'use client';
import { useState } from 'react';
import { sb } from '@/lib/supabase';
import { toast } from '@/lib/ui';

export default function Login() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [name, setName] = useState(''); const [reg, setReg] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const r = reg ? await sb.auth.signUp({ email, password: pw, options: { data: { full_name: name } } }) : await sb.auth.signInWithPassword({ email, password: pw });
    if (r.error) return toast(r.error.message);
    if (reg && !r.data.session) return toast('Cuenta creada. Revisa tu correo para confirmarla.');
    location.href = '/';
  }
  return (
    <form className="login" onSubmit={go}>
      <h2 style={{ fontSize: 28 }}>LUDENT</h2>
      <p className="mu">{reg ? 'Crear cuenta' : 'Iniciar sesión'}</p>
      {reg && <label className="lbl">Nombre<input style={{ width: '100%' }} value={name} onChange={(e) => setName(e.target.value)} required /></label>}
      <label className="lbl">Correo<input style={{ width: '100%' }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="lbl">Contraseña<input style={{ width: '100%' }} type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      <button className="b" style={{ width: '100%' }}>{reg ? 'Registrarme' : 'Entrar'}</button>
      <p className="mu" style={{ cursor: 'pointer' }} onClick={() => setReg(!reg)}>{reg ? 'Ya tengo cuenta' : 'Crear cuenta (el primer usuario será administrador)'}</p>
    </form>
  );
}
