import React, { useEffect, useState } from 'react';
import { api, fechaCorta } from './api.js';

// SPEC-5: el texto de la IA es contenido no confiable. React lo inserta como texto plano (nunca como HTML).
export default function Asistente() {
  const [enviadas, setEnviadas] = useState([]);
  const [sel, setSel] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { api('GET', '/requests?estado=ENVIADA&pageSize=100').then((d) => setEnviadas(d.items)); }, []);

  const alternar = (c) => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : sel.length < 20 ? [...sel, c] : sel);

  async function generar() {
    setError(null); setResumen(null); setCargando(true);
    try { setResumen(await api('POST', '/ai/summaries', { body: { requestIds: sel } })); } catch (e) { setError(e.message); } finally { setCargando(false); }
  }
  async function aprobar() {
    setError(null);
    try { setResumen(await api('POST', `/ai/summaries/${resumen.id}/approve`)); } catch (e) { setError(e.message); }
  }

  return (
    <section aria-labelledby="t-ia">
      <h1 id="t-ia">Asistente de priorización</h1>
      <p className="nota">Seleccione de 1 a 20 solicitudes ENVIADA. El asistente propone un borrador; usted decide. Aprobar no reserva, despacha ni cambia prioridades.</p>
      <fieldset className="seleccion">
        <legend>Solicitudes ENVIADA ({sel.length}/20 seleccionadas)</legend>
        {enviadas.length === 0 && <p>No hay solicitudes ENVIADA.</p>}
        {enviadas.map((s) => (
          <div key={s.codigo} className="check">
            <input type="checkbox" id={`sel-${s.codigo}`} checked={sel.includes(s.codigo)} onChange={() => alternar(s.codigo)} />
            <label htmlFor={`sel-${s.codigo}`}>{s.codigo} · {s.prioridad} · {s.zona} · {fechaCorta(s.fechaRequerida)}</label>
          </div>
        ))}
      </fieldset>
      <div className="acciones"><button type="button" disabled={sel.length === 0 || cargando} onClick={generar}>{cargando ? 'Generando (máximo 5 s)…' : 'Generar resumen'}</button></div>
      {error && <p className="error-general" role="alert">{error}</p>}
      {resumen && (
        <article className="resumen" aria-labelledby="t-res">
          <header>
            <span className="sello">{resumen.etiqueta}</span>
            <span className="estado">{resumen.estado}</span>
            <span className="origen">Origen: {resumen.origen === 'IA' ? 'modelo de IA' : 'resumen determinista'}</span>
          </header>
          <h2 id="t-res">Borrador de resumen</h2>
          {resumen.aviso && <p className="aviso" role="status">{resumen.aviso}</p>}
          <p className="texto-ia">{resumen.summary}</p>
          {resumen.recommendations.length > 0 && (
            <ol className="recs">
              {resumen.recommendations.map((r) => (
                <li key={r.requestId}><strong>{r.requestId}</strong>: <span className="texto-ia">{r.reason}</span> <em>(evidencia: {r.evidenceFields.join(', ')})</em></li>
              ))}
            </ol>
          )}
          <p className="nota">Revise los datos fuente antes de actuar. La recomendación no es una decisión.</p>
          {resumen.estado === 'BORRADOR'
            ? <button type="button" onClick={aprobar}>Aprobar resumen</button>
            : <p className="ok" role="status">Resumen aprobado el {fechaCorta(resumen.aprobadoEn)}.</p>}
        </article>
      )}
    </section>
  );
}
