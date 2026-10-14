import React, { useEffect, useState } from 'react';
import { api, fechaCorta } from './api.js';

export function Inventario() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api('GET', '/inventory?pageSize=100').then(setD).catch((e) => setError(e.message)); }, []);
  return (
    <section aria-labelledby="t-inv">
      <h1 id="t-inv">Inventario</h1>
      {error && <p className="error-general" role="alert">{error}</p>}
      {d && (
        <table className="tabla">
          <thead><tr><th scope="col">SKU</th><th scope="col">Producto</th><th scope="col">Existencia física</th><th scope="col">Reservada</th><th scope="col">Disponible</th></tr></thead>
          <tbody>{d.items.map((i) => (
            <tr key={i.sku}><td data-label="SKU">{i.sku}</td><td data-label="Producto">{i.nombre}</td><td data-label="Existencia física">{i.existenciaFisica}</td><td data-label="Reservada">{i.reservada}</td><td data-label="Disponible"><strong>{i.disponible}</strong></td></tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}

export function Auditoria() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  async function cargar(e) {
    e?.preventDefault();
    setError(null);
    const q = new URLSearchParams({ pageSize: '100' });
    if (desde) q.set('desde', new Date(desde).toISOString());
    if (hasta) q.set('hasta', new Date(hasta).toISOString());
    try { setD(await api('GET', `/audit?${q}`)); } catch (err) { setError(err); }
  }
  useEffect(() => { cargar(); }, []);

  return (
    <section aria-labelledby="t-aud">
      <h1 id="t-aud">Auditoría</h1>
      <p className="nota">Historial de solo lectura: cada transición exitosa y cada aprobación de resumen de IA. Fechas mostradas en hora de Colombia; se guardan en UTC.</p>
      <form className="filtros" onSubmit={cargar}>
        <div><label htmlFor="desde">Desde</label><input id="desde" type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)}
          aria-invalid={error?.field === 'desde'} aria-describedby={error?.field === 'desde' ? 'desde-error' : undefined} />
          {error?.field === 'desde' && <p id="desde-error" className="error-campo">{error.message}</p>}</div>
        <div><label htmlFor="hasta">Hasta</label><input id="hasta" type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div className="boton-filtro"><button type="submit">Filtrar</button></div>
      </form>
      {error && !error.field && <p className="error-general" role="alert">{error.message}</p>}
      {d && (
        <table className="tabla">
          <thead><tr><th scope="col">Fecha</th><th scope="col">Acción</th><th scope="col">Recurso</th><th scope="col">Actor</th><th scope="col">correlationId</th></tr></thead>
          <tbody>
            {d.items.map((e) => (
              <tr key={e.id}><td data-label="Fecha">{fechaCorta(e.fechaUtc)}</td><td data-label="Acción">{e.accion}</td><td data-label="Recurso">{e.recurso} {e.recursoId}</td><td data-label="Actor">#{e.actorId}</td><td data-label="correlationId" className="mono">{e.correlationId}</td></tr>
            ))}
            {d.items.length === 0 && <tr><td colSpan={5}>Sin eventos en el rango.</td></tr>}
          </tbody>
        </table>
      )}
    </section>
  );
}
