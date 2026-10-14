#!/usr/bin/env python3
"""Exporta cada specs/*/spec.md (fuente única) a spec.json con la estructura del anexo 13.

Uso:
  python3 scripts/export_specs.py          # regenera los spec.json
  python3 scripts/export_specs.py --check  # compara SIN regenerar; sale con 1 si hay diferencias (CI)
"""
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent / "specs"


def filas(bloque):
    out = []
    for linea in bloque.strip().splitlines():
        if not linea.startswith("|") or re.match(r"^\|(\s*-+\s*\|)+\s*$", linea):
            continue
        celdas = [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", linea.strip())[1:-1]]
        out.append(celdas)
    return out[1:]  # sin encabezado


def secciones(md):
    partes = re.split(r"^## (.+)$", md, flags=re.M)
    return partes[0], {partes[i].strip(): partes[i + 1] for i in range(1, len(partes), 2)}


def exportar(md_path):
    md = md_path.read_text(encoding="utf-8")
    cabecera, s = secciones(md)
    titulo = re.search(r"^# (SPEC-\d+) · (.+)$", cabecera, flags=re.M)
    meta = dict(filas(cabecera))
    lista = lambda txt, pat: [m.strip() for m in re.findall(pat, txt, flags=re.M)]
    return {
        "id": titulo.group(1),
        "version": meta["Versión"],
        "name": titulo.group(2).strip(),
        "story": {"id": meta["Historia"], "as": meta["Como"], "want": meta["Quiero"], "soThat": meta["Para"]},
        "requirements": [r.strip() for r in meta["Requisitos"].split(",")],
        "review": {"author": meta["Autor"], "reviewer": meta["Revisor"], "dateAndCommit": meta["Fecha y commit de revisión"]},
        "description": s["Descripción"].strip(),
        "inputs": [{"field": f, "type": t, "validation": [v.strip() for v in val.split(";")]} for f, t, val in filas(s["Entradas"])],
        "process": lista(s["Proceso"], r"^\d+\. (.+)$"),
        "outputs": [{"condition": c, "result": r} for c, r in filas(s["Salidas"])],
        "businessRules": lista(s["Reglas"], r"^- (.+)$"),
        "edgeCases": lista(s["Casos límite"], r"^- (.+)$"),
        "acceptanceCriteria": [{"id": i, "given": g, "when": w, "then": t} for i, g, w, t in filas(s["Criterios de aceptación"])],
    }


def main():
    check = "--check" in sys.argv
    diferencias = 0
    specs = sorted(RAIZ.glob("*/spec.md"))
    for md in specs:
        nuevo = json.dumps(exportar(md), ensure_ascii=False, indent=2) + "\n"
        destino = md.with_name("spec.json")
        if check:
            actual = destino.read_text(encoding="utf-8") if destino.exists() else None
            if actual != nuevo:
                diferencias += 1
                print(f"DIFERENCIA: {destino.relative_to(RAIZ.parent)} no coincide con su spec.md")
        else:
            destino.write_text(nuevo, encoding="utf-8")
            print(f"exportado: {destino.relative_to(RAIZ.parent)}")
    if check:
        if diferencias:
            print(f"{diferencias} spec.json desactualizado(s). Ejecute: python3 scripts/export_specs.py")
            sys.exit(1)
        print(f"OK: {len(specs)} spec.json coinciden con su fuente")


if __name__ == "__main__":
    main()
