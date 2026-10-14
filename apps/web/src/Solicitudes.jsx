import React, { useEffect, useState } from 'react';
import { api, uuid, ESTADOS, ZONAS, fechaCorta } from './api.js';

const Estado = ({ e }) => <span className={`estado e-${e.toLowerCase()}`}>{e}</span>;

export function Solicitudes({ usuario, onAbrir }) {
  const [filtros, setFiltros] = useState({ estado: '', prioridad: '', zona: '' });
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState(null);
  const [tablero, setTablero] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: '20' });
    for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
    setError(null);
    api('GET', `/requests?${q}`).then(setDatos).catch((e) => setError(e.message));
    api('GET', '/dashboard').then(setTablero).catch(() => {});
  }, [filtros, page]);

  const cambiar = (k) => (e) => { setPage(1); setFiltros({ ...filtros, [k]: e.target.value }); };
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1;

  return (
    <section aria-labelledby="t-sol">
      <h1 id="t-sol">{usuario.rol === 'SOLICITANTE' ? 'Mis solicitudes' : `Solicitudes de ${usuario.organizacion}`}</h1>
      {tablero && (
        <ul className="tablero" aria-label="Solicitudes por estado">
          {ESTADOS.map((e) => <li key={e}><span className="num">{tablero.conteos[e]}</span><span>{e}</span></li>)}
        </ul>
      )}
      <form className="filtros" onSubmit={(e) => e.preventDefault()} aria-label="Filtros">
        <div><label htmlFor="f-estado">Estado</label>
          <select id="f-estado" value={filtros.estado} onChange={cambiar('estado')}><option value="">Todos</option>{ESTADOS.map((e) => <option key={e}>{e}</option>)}</select></div>
        <div><label htmlFor="f-prioridad">Prioridad</label>
          <select id="f-prioridad" value={filtros.prioridad} onChange={cambiar('prioridad')}><option value="">Todas</option><option>ALTA</option><option>NORMAL</option></select></div>
        <div><label htmlFor="f-zona">Zona</label>
          <select id="f-zona" value={filtros.zona} onChange={cambiar('zona')}><option value="">Todas</option>{ZONAS.map((z) => <option key={z}>{z}</option>)}</select></div>
      </form>
      {error && <p className="error-general" role="alert">{error}</p>}
      {datos && (
        <>
          <table className="tabla">
            <thead><tr><th scope="col">Código</th><th scope="col">Estado</th><th scope="col">Prioridad</th><th scope="col">Zona</th><th scope="col">Fecha requerida</th><th scope="col">Líneas</th></tr></thead>
            <tbody>
              {datos.items.map((s) => (
                <tr key={s.codigo}>
                  <td data-label="Código"><button type="button" className="enlace" onClick={() => onAbrir(s.codigo)}>{s.codigo}</button></td>
                  <td data-label="Estado"><Estado e={s.estado} /></td>
                  <td data-label="Prioridad">{s.prioridad}</td>
                  <td data-label="Zona">{s.zona}</td>
                  <td data-label="Fecha requerida">{fechaCorta(s.fechaRequerida)}</td>
                  <td data-label="Líneas">{s.lineas}</td>
                </tr>
              ))}
              {datos.items.length === 0 && <tr><td colSpan={6}>No hay solicitudes con estos filtros.</td></tr>}
            </tbody>
          </table>
          <div className="paginacion">
            <button type="button" className="secundario" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
            <span>Página {page} de {paginas} · {datos.total} en total</span>
            <button type="button" className="secundario" disabled={page >= paginas} onClick={() => setPage(page + 1)}>Siguiente</button>
          </div>
        </>
      )}
    </section>
  );
}

export function Detalle({ usuario, codigo, onVolver, onEditar }) {
  const [s, setS] = useState(null);
  const [inv, setInv] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => { api('GET', `/requests/${codigo}`).then(setS).catch((e) => setError(e.message)); }, [codigo]);

  async function accion(ruta, texto, headers) {
    setError(null); setAviso(null);
    try {
      const r = await api('POST', `/requests/${codigo}/${ruta}`, { headers });
      setS(r);
      if (r.inventario) setInv(r.inventario);
      setAviso(texto);
    } catch (e) { setError(e.message); }
  }

  if (error && !s) return <p className="error-general" role="alert">{error}</p>;
  if (!s) return <p role="status">Cargando…</p>;
  const esDueno = usuario.rol === 'SOLICITANTE' && s.solicitante.id === usuario.id;
  const acciones = [];
  if (esDueno && s.estado === 'BORRADOR') {
    acciones.push(<button key="ed" type="button" className="secundario" onClick={() => onEditar(codigo)}>Editar borrador</button>);
    acciones.push(<button key="en" type="button" onClick={() => accion('submit', 'Solicitud enviada')}>Enviar solicitud</button>);
  }
  if (esDueno && ['ENVIADA', 'RESERVADA'].includes(s.estado)) acciones.push(<button key="ca" type="button" className="peligro" onClick={() => accion('cancel', 'Solicitud cancelada')}>Cancelar solicitud</button>);
  if (usuario.rol === 'COORDINADOR' && s.estado === 'ENVIADA') acciones.push(<button key="re" type="button" onClick={() => accion('reserve', 'Inventario reservado', { 'Idempotency-Key': uuid() })}>Reservar inventario</button>);
  if (usuario.rol === 'BODEGA' && s.estado === 'RESERVADA') acciones.push(<button key="de" type="button" onClick={() => accion('dispatch', 'Solicitud despachada')}>Despachar</button>);
  if (usuario.rol === 'COORDINADOR' && s.estado === 'DESPACHADA') acciones.push(<button key="et" type="button" onClick={() => accion('deliver', 'Entrega registrada')}>Registrar entrega</button>);

  return (
    <section aria-labelledby="t-det">
      <button type="button" className="enlace" onClick={onVolver}>← Volver al listado</button>
      <h1 id="t-det">Solicitud {s.codigo} <Estado e={s.estado} /></h1>
      <dl className="ficha">
        <div><dt>Solicitante</dt><dd>{s.solicitante.nombre}</dd></div>
        <div><dt>Zona</dt><dd>{s.zona}</dd></div>
        <div><dt>Prioridad</dt><dd>{s.prioridad}</dd></div>
        <div><dt>Fecha requerida</dt><dd>{fechaCorta(s.fechaRequerida)}</dd></div>
        <div className="ancho"><dt>Observaciones</dt><dd>{s.observaciones || '—'}</dd></div>
      </dl>
      <h2>Líneas</h2>
      <table className="tabla">
        <thead><tr><th scope="col">SKU</th><th scope="col">Producto</th><th scope="col">Cantidad</th></tr></thead>
        <tbody>{s.lineas.map((l) => <tr key={l.sku}><td data-label="SKU">{l.sku}</td><td data-label="Producto">{l.nombre}</td><td data-label="Cantidad">{l.cantidad}</td></tr>)}</tbody>
      </table>
      {aviso && <p className="ok" role="status">{aviso}</p>}
      {error && <p className="error-general" role="alert">{error}</p>}
      {inv && (
        <p className="nota">Inventario después de la operación: {inv.map((i) => `${i.sku}: físico ${i.existenciaFisica}, reservado ${i.reservada}, disponible ${i.disponible}`).join(' · ')}</p>
      )}
      {acciones.length > 0 && <div className="acciones">{acciones}</div>}
    </section>
  );
}

const vacio = () => ({ zona: 'NORTE', prioridad: 'NORMAL', fecha: '', observaciones: '', lineas: [{ sku: '', cantidad: '1' }] });

export function FormSolicitud({ codigo, onListo }) {
  const [f, setF] = useState(vacio());
  const [catalogo, setCatalogo] = useState([]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [creado, setCreado] = useState(codigo || null);

  useEffect(() => {
    api('GET', '/catalog').then((c) => {
      setCatalogo(c.items);
      if (!codigo) setF((x) => ({ ...x, lineas: [{ sku: c.items[0]?.sku || '', cantidad: '1' }] }));
    });
    if (codigo) {
      api('GET', `/requests/${codigo}`).then((s) => setF({
        zona: s.zona, prioridad: s.prioridad, fecha: s.fechaRequerida.slice(0, 16), observaciones: s.observaciones || '',
        lineas: s.lineas.map((l) => ({ sku: l.sku, cantidad: String(l.cantidad) })),
      }));
    }
  }, [codigo]);

  const cuerpo = () => ({
    zona: f.zona, prioridad: f.prioridad,
    fechaRequerida: f.fecha ? new Date(f.fecha).toISOString() : '',
    observaciones: f.observaciones || null,
    lineas: f.lineas.map((l) => ({ sku: l.sku, cantidad: l.cantidad === '' ? null : Number(l.cantidad) })),
  });

  async function guardar(enviar) {
    setError(null); setEnviando(true);
    let actual = creado;
    try {
      if (actual) await api('PUT', `/requests/${actual}`, { body: cuerpo() });
      else { actual = (await api('POST', '/requests', { body: cuerpo() })).codigo; setCreado(actual); }
      if (enviar) await api('POST', `/requests/${actual}/submit`, { body: cuerpo() });
      onListo(actual);
    } catch (e) {
      setError({ field: e.field || 'general', message: e.message, codigo: actual });
    } finally { setEnviando(false); }
  }

  const err = (campo) => (error && error.field === campo ? error.message : null);
  const props = (campo, id) => ({ id, 'aria-invalid': !!err(campo), 'aria-describedby': err(campo) ? `${id}-error` : undefined });
  const Err = ({ campo, id }) => (err(campo) ? <p id={`${id}-error`} className="error-campo">{err(campo)}</p> : null);
  const setLinea = (i, k, v) => setF({ ...f, lineas: f.lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });

  return (
    <section aria-labelledby="t-form">
      <h1 id="t-form">{codigo ? `Editar borrador ${codigo}` : 'Nueva solicitud'}</h1>
      <form className="formulario" onSubmit={(e) => { e.preventDefault(); guardar(true); }} noValidate>
        <div className="fila">
          <div><label htmlFor="zona">Zona</label>
            <select {...props('zona', 'zona')} value={f.zona} onChange={(e) => setF({ ...f, zona: e.target.value })}>{ZONAS.map((z) => <option key={z}>{z}</option>)}</select>
            <Err campo="zona" id="zona" /></div>
          <div><label htmlFor="prioridad">Prioridad</label>
            <select {...props('prioridad', 'prioridad')} value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value })}><option>NORMAL</option><option>ALTA</option></select>
            <Err campo="prioridad" id="prioridad" /></div>
          <div><label htmlFor="fecha">Fecha requerida</label>
            <input type="datetime-local" {...props('fechaRequerida', 'fecha')} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
            <Err campo="fechaRequerida" id="fecha" /></div>
        </div>
        <label htmlFor="observaciones">Observaciones (opcional, máximo 500)</label>
        <textarea {...props('observaciones', 'observaciones')} rows={3} value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} />
        <Err campo="observaciones" id="observaciones" />
        <fieldset>
          <legend>Líneas (1 a 10)</legend>
          {f.lineas.map((l, i) => (
            <div className="linea" key={i}>
              <div><label htmlFor={`sku-${i}`}>Producto {i + 1}</label>
                <select {...props(`lineas[${i}].sku`, `sku-${i}`)} value={l.sku} onChange={(e) => setLinea(i, 'sku', e.target.value)}>
                  {catalogo.map((p) => <option key={p.sku} value={p.sku}>{p.nombre} ({p.sku})</option>)}
                </select>
                <Err campo={`lineas[${i}].sku`} id={`sku-${i}`} /></div>
              <div><label htmlFor={`cantidad-${i}`}>Cantidad</label>
                <input type="number" inputMode="numeric" {...props(`lineas[${i}].cantidad`, `cantidad-${i}`)} value={l.cantidad} onChange={(e) => setLinea(i, 'cantidad', e.target.value)} />
                <Err campo={`lineas[${i}].cantidad`} id={`cantidad-${i}`} /></div>
              {f.lineas.length > 1 && <button type="button" className="secundario quitar" onClick={() => setF({ ...f, lineas: f.lineas.filter((_, j) => j !== i) })} aria-label={`Quitar producto ${i + 1}`}>Quitar</button>}
            </div>
          ))}
          <Err campo="lineas" id="lineas" />
          {f.lineas.length < 10 && <button type="button" className="secundario" onClick={() => setF({ ...f, lineas: [...f.lineas, { sku: catalogo[0]?.sku || '', cantidad: '1' }] })}>Agregar producto</button>}
        </fieldset>
        {err('general') && <p className="error-general" role="alert">{err('general')}</p>}
        <div className="acciones">
          <button type="button" className="secundario" disabled={enviando} onClick={() => guardar(false)}>Guardar borrador</button>
          <button type="submit" disabled={enviando}>Guardar y enviar</button>
        </div>
      </form>
    </section>
  );
}
