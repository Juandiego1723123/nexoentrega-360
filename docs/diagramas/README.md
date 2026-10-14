# Diagramas

| Archivo | Contenido | Fuente |
|---|---|---|
| `contexto.png` | Contexto y fronteras de confianza F1–F4 | `contexto.dot` (Graphviz) |
| `componentes.png` | Componentes y comunicación | documento de entrega, figura 2 |
| `estados.png` | Ciclo de estados de una solicitud (RF04) | documento de entrega, figura 1 |
| `modelo_datos.png` | Modelo entidad-relación generado desde la base real | `er.dot`, columnas leídas de `information_schema` |
| `seq_reserva.png` | Secuencia 1: reserva concurrente (AC-RF07-03) | `secuencias.py` |
| `seq_ia.png` | Secuencia 2: consulta de IA con fallo (AC-RF12-01) | `secuencias.py` |

Regenerar: `dot -Tpng contexto.dot -o contexto.png`, `dot -Tpng er.dot -o modelo_datos.png`, `python3 secuencias.py .`
