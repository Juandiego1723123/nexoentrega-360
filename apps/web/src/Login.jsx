import React, { useState } from 'react';
import { api } from './api.js';

export default function Login({ onEntrar }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      onEntrar(await api('POST', '/auth/login', { body: { email: email.trim(), password } }));
    } catch (err) {
      setError({ field: err.field || 'general', message: err.message });
    } finally {
      setEnviando(false);
    }
  }

  const err = (f) => (error && error.field === f ? error.message : null);
  return (
    <main className="login">
      <form onSubmit={entrar} noValidate aria-labelledby="titulo-login">
        <h1 id="titulo-login">NexoEntrega 360</h1>
        <p className="sub">Distribución comunitaria de kits</p>
        <label htmlFor="email">Correo</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!err('email')} aria-describedby={err('email') ? 'email-error' : undefined} required />
        {err('email') && <p id="email-error" className="error-campo">{err('email')}</p>}
        <label htmlFor="password">Contraseña</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!err('password')} aria-describedby={err('password') ? 'password-error' : undefined} required />
        {err('password') && <p id="password-error" className="error-campo">{err('password')}</p>}
        {err('general') && <p className="error-general" role="alert">{err('general')}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Ingresando…' : 'Iniciar sesión'}</button>
        <p className="ayuda">Cuentas de demostración: org-a-solicitante@example.test, org-a-coordinador@example.test, org-a-bodega@example.test, org-a-auditor@example.test (y sus equivalentes org-b). La contraseña está en el runbook.</p>
      </form>
    </main>
  );
}
