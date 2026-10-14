import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

plt.rcParams["font.family"] = "DejaVu Sans"
NEGRO = "#1A1A1A"; GRIS = "#404040"; RELLENO = "#F2F2F2"; OSCURO = "#E0E0E0"; TENUE = "#7F7F7F"


def secuencia(path, participantes, pasos, alto_paso=0.62, ancho=11.5, notas_bloque=None, titulo_ancho=1.9):
    n = len(pasos)
    alto = 1.6 + n * alto_paso + 0.4
    fig, ax = plt.subplots(figsize=(ancho, alto * 0.82))
    xs = {p: x for p, (x, _) in participantes.items()}
    ax.set_xlim(0, ancho); ax.set_ylim(0, alto); ax.axis("off")
    top = alto - 0.35
    for p, (x, etiqueta) in participantes.items():
        fc = OSCURO if p == "API" else RELLENO
        ax.add_patch(FancyBboxPatch((x - titulo_ancho / 2, top - 0.8), titulo_ancho, 0.8,
                                    boxstyle="round,pad=0.02,rounding_size=0.12", fc=fc, ec=NEGRO, lw=1.2))
        ax.text(x, top - 0.4, etiqueta, ha="center", va="center", fontsize=9.5, color=NEGRO)
        ax.plot([x, x], [top - 0.8, 0.25], color=TENUE, lw=1, ls=(0, (4, 3)), zorder=0)
    y = top - 0.8 - 0.45
    for paso in pasos:
        tipo = paso[0]
        if tipo == "msg":
            _, a, b, texto, *estilo = paso
            dashed = bool(estilo and estilo[0] == "resp")
            x1, x2 = xs[a], xs[b]
            if a == b:  # auto-mensaje
                ax.annotate("", xy=(x1 + 0.08, y - 0.22), xytext=(x1 + 0.08, y),
                            arrowprops=dict(arrowstyle="-|>", color=GRIS, lw=1.1,
                                            connectionstyle="arc3,rad=-1.6"))
                ax.text(x1 + 0.45, y - 0.1, texto, ha="left", va="center", fontsize=8.6, color=NEGRO)
            else:
                ax.annotate("", xy=(x2, y), xytext=(x1, y),
                            arrowprops=dict(arrowstyle="-|>", color=GRIS, lw=1.1,
                                            ls="--" if dashed else "-", shrinkA=0, shrinkB=0))
                ax.text((x1 + x2) / 2, y + 0.07, texto, ha="center", va="bottom", fontsize=8.6, color=NEGRO,
                        bbox=dict(fc="white", ec="none", pad=0.6), zorder=3)
        elif tipo == "nota":
            _, a, b, texto = paso
            cx = (xs[a] + xs[b]) / 2
            w = max(abs(xs[b] - xs[a]) + 1.5, len(texto) * 0.085 + 0.4)
            x1, x2 = cx - w / 2, cx + w / 2
            ax.add_patch(FancyBboxPatch((x1, y - 0.2), x2 - x1, 0.4, boxstyle="round,pad=0.01,rounding_size=0.05",
                                        fc="white", ec=TENUE, lw=0.9, ls="--", zorder=2))
            ax.text((x1 + x2) / 2, y, texto, ha="center", va="center", fontsize=8.4, color=GRIS, style="italic", zorder=3)
        y -= alto_paso
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)


def reserva(path):
    P = {"P1": (1.0, "Coordinador\npetición 1 · A-001"), "P2": (3.4, "Coordinador\npetición 2 · A-002"),
         "API": (6.4, "API HTTP"), "DB": (9.8, "PostgreSQL")}
    pasos = [
        ("nota", "P1", "DB", "Antes (oráculo del anexo): KIT-ALIMENTO físico 10, reservado 0, disponible 10; A-001 y A-002 piden 7 cada una"),
        ("msg", "P1", "API", "POST /requests/A-001/reserve · Idempotency-Key k1"),
        ("msg", "P2", "API", "POST /requests/A-002/reserve · Idempotency-Key k2"),
        ("nota", "API", "API", "API: sesión · misma organización (si no, 404) · rol COORDINADOR (si no, 403) · clave UUID (si no, 422)"),
        ("msg", "API", "DB", "T1: BEGIN · INSERT idempotency_keys (k1) ON CONFLICT DO NOTHING"),
        ("msg", "API", "DB", "T1: SELECT A-001 FOR UPDATE (ENVIADA) · SELECT inventario ORDER BY producto FOR UPDATE"),
        ("msg", "API", "DB", "T2: BEGIN · INSERT k2 · SELECT A-002 FOR UPDATE · SELECT inventario … FOR UPDATE"),
        ("nota", "API", "DB", "T2 queda en espera: T1 tiene bloqueada la fila de KIT-ALIMENTO"),
        ("msg", "API", "DB", "T1: disponible 10 ≥ 7 → reserved += 7 · A-001 RESERVADA"),
        ("msg", "API", "DB", "T1: INSERT audit_events · UPDATE idempotency_keys (k1 → 200) · COMMIT"),
        ("msg", "API", "P1", "200 · RESERVADA · físico 10, reservado 7, disponible 3", "resp"),
        ("msg", "API", "DB", "T2 continúa: disponible 3 < 7 → nada cambia en inventario ni estado"),
        ("msg", "API", "DB", "T2: UPDATE idempotency_keys (k2 → 409, error de negocio) · COMMIT"),
        ("msg", "API", "P2", "409 STOCK_INSUFICIENTE · A-002 sigue ENVIADA", "resp"),
        ("nota", "P1", "DB", "Después: reservado 7 · un solo evento · ningún valor negativo (CHECK) · probado en 5 rondas (AC-RF07-03)"),
    ]
    secuencia(path, P, pasos, ancho=12.2, titulo_ancho=2.1)


def ia(path):
    P = {"C": (1.0, "Coordinador\nORG-A"), "API": (3.9, "API HTTP"), "AD": (6.9, "Adaptador de IA"),
         "M": (9.3, "Modelo\n(Ollama)"), "DB": (11.4, "PostgreSQL")}
    pasos = [
        ("msg", "C", "API", "POST /ai/summaries · requestIds (1–20)"),
        ("nota", "API", "API", "API: rol COORDINADOR (si no, 403) · IDs ENVIADA y de ORG-A (si no, 422 sin invocar IA)"),
        ("msg", "API", "AD", "solicitudes con campos mínimos"),
        ("nota", "API", "AD", "solo requestId, zona, prioridad, fecha requerida, estado y observaciones"),
        ("msg", "AD", "M", "prompt con límite de 5 s"),
        ("nota", "AD", "M", "fallo: el modelo no responde en 5 s, o responde JSON inválido / ID ajeno"),
        ("msg", "M", "AD", "timeout o salida rechazada por JSON Schema", "resp"),
        ("nota", "AD", "AD", "Adaptador: descartar salida · generar resumen determinista (prioridad y zona)"),
        ("msg", "AD", "API", "resumen · origen = determinista", "resp"),
        ("msg", "API", "DB", "INSERT resumen BORRADOR · marca «Asistencia de IA» · origen"),
        ("msg", "API", "C", "201 · borrador + aviso controlado de que la IA falló", "resp"),
        ("msg", "C", "API", "POST /ai/summaries/{id}/approve (decisión humana)"),
        ("msg", "API", "DB", "UPDATE resumen APROBADO · INSERT 1 evento de auditoría"),
        ("msg", "API", "C", "200 · solicitudes, inventario y prioridades sin cambios", "resp"),
    ]
    secuencia(path, P, pasos, ancho=12.6, titulo_ancho=1.7)


if __name__ == "__main__":
    import sys
    reserva(f"{sys.argv[1]}/seq_reserva.png")
    ia(f"{sys.argv[1]}/seq_ia.png")
