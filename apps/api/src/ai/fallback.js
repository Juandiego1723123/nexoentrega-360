'use strict';
// RF12 · resumen determinista: no depende de ningún modelo y siempre cumple el esquema de salida.

function resumenDeterminista(solicitudes) {
  const porPrioridad = { ALTA: 0, NORMAL: 0 };
  const porZona = {};
  for (const s of solicitudes) {
    porPrioridad[s.prioridad] += 1;
    porZona[s.zona] = (porZona[s.zona] || 0) + 1;
  }
  const zonas = Object.entries(porZona).sort(([a], [b]) => a.localeCompare(b)).map(([z, n]) => `${z} ${n}`).join(', ');
  const ordenadas = [...solicitudes].sort((a, b) =>
    (a.prioridad === b.prioridad ? 0 : a.prioridad === 'ALTA' ? -1 : 1) ||
    a.fechaRequerida.localeCompare(b.fechaRequerida) || a.requestId.localeCompare(b.requestId));
  const fecha = (iso) => iso.slice(0, 10);
  return {
    summary: `${solicitudes.length} solicitud(es) ENVIADA: ${porPrioridad.ALTA} con prioridad ALTA y ${porPrioridad.NORMAL} NORMAL. Por zona: ${zonas}.`.slice(0, 600),
    recommendations: ordenadas.slice(0, 5).map((s) => ({
      requestId: s.requestId,
      reason: `Prioridad ${s.prioridad} y fecha requerida ${fecha(s.fechaRequerida)}.`,
      evidenceFields: ['prioridad', 'fechaRequerida'],
    })),
  };
}

module.exports = { resumenDeterminista };
