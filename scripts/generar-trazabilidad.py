#!/usr/bin/env python3
"""Genera docs/traceability.md y docs/spec-vs-code.csv a partir de specs/*/spec.json y de los resultados de pruebas guardados."""
import csv
import json
import pathlib
import re

R = pathlib.Path(__file__).resolve().parent.parent
salida = (R / "evidence/tests/pruebas-unitarias-integracion.txt").read_text(encoding="utf-8")
k6 = R / "evidence/tests/k6-summary.json"

# Requisito → historia, tarea, módulo y archivo de prueba
MAPA = {
    "RF01": ("HU-01", "T-01", "apps/api/src/middleware/auth.js (login, logout, autenticar)", "tests/integration/spec1-identidad.test.js"),
    "RF02": ("HU-01", "T-02", "apps/api/src/services/requests.js (loadForUser, exigirDueno)", "tests/integration/spec1-identidad.test.js"),
    "RF03": ("HU-02", "T-03", "apps/api/src/validate.js; services/requests.js (crear, enviar)", "tests/integration/spec2-solicitudes.test.js; tests/unit/validate.test.js"),
    "RF04": ("HU-02", "T-04", "apps/api/src/services/requests.js (TRANSITIONS)", "tests/integration/spec2-solicitudes.test.js"),
    "RF05": ("HU-03", "T-05", "apps/api/src/services/requests.js (reservar, bloquearInventario)", "tests/integration/spec3-inventario.test.js"),
    "RF06": ("HU-03", "T-06", "apps/api/src/services/requests.js (transicionConInventario)", "tests/integration/spec3-inventario.test.js"),
    "RF07": ("HU-03", "T-07", "apps/api/src/services/requests.js (reservar); tabla idempotency_keys", "tests/integration/spec3-inventario.test.js"),
    "RF08": ("HU-04", "T-08", "apps/api/src/services/requests.js (listar, dashboard, inventario)", "tests/integration/spec4-consultas.test.js"),
    "RF09": ("HU-04", "T-09", "services/requests.js (audit, auditoria); trigger en migrations/001_init.sql", "tests/integration/spec4-consultas.test.js"),
    "RF10": ("HU-05", "T-10", "apps/api/src/services/ai.js (crearResumen)", "tests/integration/spec5-ia.test.js"),
    "RF11": ("HU-05", "T-11", "apps/api/src/ai/validator.js; ai/schema.json", "tests/integration/spec5-ia.test.js; tests/unit/ai.test.js"),
    "RF12": ("HU-05", "T-12", "apps/api/src/services/ai.js (conLimite, aprobar); ai/fallback.js", "tests/integration/spec5-ia.test.js"),
    "RNF01": ("HU-01", "T-13", "apps/api/src/middleware/auth.js; validate.js", "tests/integration/spec1-identidad.test.js"),
    "RNF02": ("HU-03", "T-14", "CHECK en migrations/001_init.sql; services/requests.js", "tests/integration/spec3-inventario.test.js"),
    "RNF03": ("HU-04", "T-15", "índices en migrations/001_init.sql", "tests/load/listados.k6.js"),
    "RNF04": ("—", "T-16", "docker-compose.yml; Dockerfile; docs/runbook.md", "docs/runbook.md (clon limpio)"),
    "RNF05": ("—", "T-17", "apps/web/src", "tests/e2e/flujo-principal.spec.js (1366 y 390 px)"),
    "RNF06": ("HU-05", "T-18", "middleware/correlation.js; app.js (/health, /ready); ai/providers.js", "tests/integration/spec5-ia.test.js"),
}

DEFECTOS = {
    "AC-RNF01-01": ("La prueba enviaba cuerpo en peticiones GET y fallaba antes de llegar a la API (defecto de la prueba, no del sistema)",
                    "La prueba envía cuerpo solo en métodos que lo admiten; la aserción de 401 se mantiene para las 18 rutas"),
}

specs = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((R / "specs").glob("*/spec.json"))]
criterios = [(s["id"], a) for s in specs for a in s["acceptanceCriteria"]]


def resultado(ac_id):
    if ac_id == "AC-RNF03-01":
        d = json.loads(k6.read_text(encoding="utf-8"))
        m = d["metrics"]
        p95 = m["http_req_duration{fase:medicion}"]["p(95)"]
        err = m["http_req_failed{fase:medicion}"]["value"]
        return ("Pasa" if p95 <= 700 and err < 0.01 else "Falla"), f"p95 {p95:.1f} ms; errores {err*100:.2f} %"
    m = re.search(rf"^\s*([✔✖]) {re.escape(ac_id)} ", salida, flags=re.M)
    if not m:
        return "Sin ejecutar", ""
    return ("Pasa" if m.group(1) == "✔" else "Falla"), ""


filas_md = ["| Req. | HU | SPEC | Criterios | Tarea | Módulo | Prueba | Resultado |", "|---|---|---|---|---|---|---|---|"]
for req, (hu, t, mod, prueba) in MAPA.items():
    ids = [a["id"] for sid, a in criterios if re.search(rf"-{req}-", a["id"])]
    spec = next((sid for sid, a in criterios if re.search(rf"-{req}-", a["id"])), "Todas")
    res = [resultado(i)[0] for i in ids]
    estado = "—" if not ids else (f"{res.count('Pasa')}/{len(ids)} pasan")
    filas_md.append(f"| {req} | {hu} | {spec} | {', '.join(ids) or 'transversal'} | {t} | {mod} | {prueba} | {estado} |")

(R / "docs/traceability.md").write_text(
    "# Matriz de trazabilidad\n\nRequerimiento → Historia → SPEC → criterio → tarea → módulo → prueba → resultado. "
    "Generada por `scripts/generar-trazabilidad.py` a partir de `specs/*/spec.json` y `evidence/tests/`. "
    "La columna PR se completa en el documento de entrega al fusionar cada rama.\n\n" + "\n".join(filas_md) + "\n",
    encoding="utf-8")

with open(R / "docs/spec-vs-code.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["spec", "criterio", "esperado", "observado", "resultado", "defecto", "correccion"])
    for sid, a in criterios:
        res, extra = resultado(a["id"])
        observado = extra or ("Se cumple lo esperado (verificado contra la base real)" if res == "Pasa" else "")
        d = DEFECTOS.get(a["id"], ("", ""))
        w.writerow([sid, a["id"], a["then"], observado, res, d[0], d[1]])

total = len(criterios)
pasan = sum(1 for _, a in criterios if resultado(a["id"])[0] == "Pasa")
print(f"trazabilidad: {total} criterios, {pasan} pasan")
