import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError, ROLES } from './api.js';
import Login from './Login.jsx';
import { Solicitudes, Detalle, FormSolicitud } from './Solicitudes.jsx';
import { Inventario, Auditoria } from './Consultas.jsx';
import Asistente from './Asistente.jsx';

const VISTAS = [
  { id: 'solicitudes', texto: 'Solicitudes', roles: ['SOLICITANTE', 'COORDINADOR', 'BODEGA', 'AUDITOR'] },
  { id: 'nueva', texto: 'Nueva solicitud', roles: ['SOLICITANTE'] },
  { id: 'inventario', texto: 'Inventario', roles: ['COORDINADOR', 'BODEGA', 'AUDITOR'] },
  { id: 'asistente', texto: 'Asistente IA', roles: ['COORDINADOR'] },
  { id: 'auditoria', texto: 'Auditoría', roles: ['AUDITOR'] },
];

export default function App() {
  const [usuario, setUsuario] = useState(undefined);
  const [vista, setVista] = useState({ id: 'solicitudes' });

  useEffect(() => {
    api('GET', '/auth/me').then(setUsuario).catch(() => setUsuario(null));
  }, []);

  const salir = useCallback(async () => {
    try { await api('POST', '/auth/logout'); } catch (e) { if (!(e instanceof ApiError)) throw e; }
    setUsuario(null);
    setVista({ id: 'solicitudes' });
  }, []);

  if (usuario === undefined) return <p className="cargando" role="status">Cargando…</p>;
  if (usuario === null) return <Login onEntrar={(u) => { setUsuario(u); setVista({ id: 'solicitudes' }); }} />;

  const ir = (id, extra = {}) => setVista({ id, ...extra });
  const permitidas = VISTAS.filter((v) => v.roles.includes(usuario.rol));

  return (
    <>
      <header className="barra">
        <div className="marca">NexoEntrega 360</div>
        <div className="quien">
          <span>{usuario.nombre}</span>
          <span className="etiqueta">{ROLES[usuario.rol]} · {usuario.organizacion}</span>
          <button type="button" className="secundario" onClick={salir}>Cerrar sesión</button>
        </div>
        <nav aria-label="Secciones">
          {permitidas.map((v) => (
            <button key={v.id} type="button" className={vista.id === v.id ? 'tab activa' : 'tab'}
              aria-current={vista.id === v.id ? 'page' : undefined} onClick={() => ir(v.id)}>{v.texto}</button>
          ))}
        </nav>
      </header>
      <main>
        {vista.id === 'solicitudes' && <Solicitudes usuario={usuario} onAbrir={(codigo) => ir('detalle', { codigo })} />}
        {vista.id === 'detalle' && <Detalle usuario={usuario} codigo={vista.codigo} onVolver={() => ir('solicitudes')} onEditar={(codigo) => ir('editar', { codigo })} />}
        {vista.id === 'nueva' && <FormSolicitud onListo={(codigo) => ir('detalle', { codigo })} />}
        {vista.id === 'editar' && <FormSolicitud codigo={vista.codigo} onListo={(codigo) => ir('detalle', { codigo })} />}
        {vista.id === 'inventario' && <Inventario />}
        {vista.id === 'auditoria' && <Auditoria />}
        {vista.id === 'asistente' && <Asistente />}
      </main>
    </>
  );
}
