import io, base64
import numpy as np, networkx as nx
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from scipy.optimize import linear_sum_assignment

app = FastAPI(title="Optimizador de redes")

class Req(BaseModel):
    fields: dict

def num(x):
    v = float(x)
    return int(v) if v.is_integer() else v

def parse_matrix(text):
    try:
        rows = [[num(x) for x in l.replace(",", " ").split()] for l in text.strip().splitlines() if l.strip()]
        if not rows or len({len(r) for r in rows}) != 1:
            raise ValueError
        return rows
    except ValueError:
        raise HTTPException(400, "Matriz inválida: una fila por línea, números separados por espacios, mismo largo en todas.")

def parse_edges(text, n_min):
    edges = []
    for l in text.strip().splitlines():
        p = l.replace(",", " ").split()
        if not p:
            continue
        if len(p) < n_min:
            raise HTTPException(400, f"Línea inválida: '{l}'")
        try:
            edges.append((p[0], p[1], *[num(x) for x in p[2:]]))
        except ValueError:
            raise HTTPException(400, f"Número inválido en: '{l}'")
    if not edges:
        raise HTTPException(400, "Ingresa al menos un arco.")
    return edges

def to_png(G, label_fn, highlight=None):
    fig, ax = plt.subplots(figsize=(7, 5))
    pos = nx.spring_layout(G, seed=3)
    nx.draw_networkx_nodes(G, pos, node_color="#cfe3ff", node_size=700, ax=ax)
    nx.draw_networkx_labels(G, pos, ax=ax)
    nx.draw_networkx_edges(G, pos, ax=ax, arrows=True, node_size=700, width=[2.5 if highlight and highlight(u, v) else 1 for u, v in G.edges()],
                           edge_color=["#d62728" if highlight and highlight(u, v) else "#888" for u, v in G.edges()])
    nx.draw_networkx_edge_labels(G, pos, {(u, v): label_fn(u, v, d) for u, v, d in G.edges(data=True)}, font_size=8, ax=ax)
    ax.axis("off")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()

# ---------- Kuhn-Munkres (implementación propia, matriz cuadrada, minimiza) ----------
def kuhn_munkres(a):
    n, INF = len(a), float("inf")
    u, v, p, way = [0] * (n + 1), [0] * (n + 1), [0] * (n + 1), [0] * (n + 1)
    for i in range(1, n + 1):
        p[0], j0 = i, 0
        minv, used = [INF] * (n + 1), [False] * (n + 1)
        while True:
            used[j0] = True
            i0, delta, j1 = p[j0], INF, 0
            for j in range(1, n + 1):
                if not used[j]:
                    cur = a[i0 - 1][j - 1] - u[i0] - v[j]
                    if cur < minv[j]:
                        minv[j], way[j] = cur, j0
                    if minv[j] < delta:
                        delta, j1 = minv[j], j
            for j in range(n + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while j0:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
    assign = [0] * n
    for j in range(1, n + 1):
        assign[p[j] - 1] = j - 1
    return assign, u[1:], v[1:]

@app.post("/api/assignment")
def assignment(r: Req):
    M = np.array(parse_matrix(r.fields["matrix"]), dtype=float)
    mx = r.fields.get("mode") == "Maximizar"
    rows, cols = linear_sum_assignment(M, maximize=mx)
    total = float(M[rows, cols].sum())
    det = [f"Agente {i+1} → Tarea {j+1}  (valor {M[i,j]:g})" for i, j in zip(rows, cols)]
    return {"summary": f"{'Beneficio máximo' if mx else 'Costo mínimo'} total = {total:g}", "details": det, "image": None}

@app.post("/api/kuhn-munkres")
def km(r: Req):
    M = parse_matrix(r.fields["matrix"])
    n_r, n_c = len(M), len(M[0])
    n = max(n_r, n_c)
    P = [[M[i][j] if i < n_r and j < n_c else 0 for j in range(n)] for i in range(n)]  # relleno con ceros
    assign, u, v = kuhn_munkres(P)
    det = [f"Fila {i+1} → Columna {j+1}  (costo {P[i][j]:g})" for i, j in enumerate(assign) if i < n_r and j < n_c]
    total = sum(P[i][j] for i, j in enumerate(assign) if i < n_r and j < n_c)
    det += ["", "Potenciales duales (u, filas): " + ", ".join(f"{x:g}" for x in u),
            "Potenciales duales (v, columnas): " + ", ".join(f"{x:g}" for x in v),
            f"Verificación dual: Σu + Σv = {sum(u)+sum(v):g}"]
    return {"summary": f"Costo mínimo total = {total:g}", "details": det, "image": None}

@app.post("/api/max-flow")
def max_flow(r: Req):
    edges = parse_edges((r.fields.get("edges") or ""), 3)
    s = (r.fields.get("source") or "").strip()
    t = (r.fields.get("sink") or "").strip()
    if not s or not t:
        raise HTTPException(400, "Indica el nodo fuente y el nodo sumidero.")
    if s == t:
        raise HTTPException(400, "La fuente y el sumidero deben ser distintos.")
    G = nx.DiGraph()
    for u, v, c in [e[:3] for e in edges]:
        if c <= 0:
            raise HTTPException(400, f"La capacidad de cada arco debe ser un número mayor que cero (arco '{u} {v} {c}').")
        G.add_edge(u, v, capacity=c)
    if s not in G or t not in G:
        raise HTTPException(400, "Fuente o sumidero no existen en la red.")
    val, flow = nx.maximum_flow(G, s, t)
    _, (cut_s, _) = nx.minimum_cut(G, s, t)
    det = [f"{u} → {v}: {f}/{G[u][v]['capacity']}" for u in flow for v, f in flow[u].items() if f > 0]
    det.append("Corte mínimo, lado fuente: " + ", ".join(sorted(map(str, cut_s))))
    img = to_png(G, lambda u, v, d: f"{flow[u][v]}/{d['capacity']}", lambda u, v: flow[u][v] > 0)
    return {"summary": f"Flujo máximo = {val}", "details": det, "image": img}

@app.post("/api/min-cost-flow")
def min_cost_flow(r: Req):
    edges = parse_edges(r.fields["edges"], 4)
    G = nx.DiGraph()
    for u, v, cap, cost in [e[:4] for e in edges]:
        G.add_edge(u, v, capacity=cap, weight=cost)
    for l in r.fields["supplies"].strip().splitlines():
        p = l.split()
        if len(p) != 2 or p[0] not in G:
            raise HTTPException(400, f"Oferta/demanda inválida: '{l}'")
        G.nodes[p[0]]["demand"] = -num(p[1])  # oferta positiva => demanda negativa
    try:
        cost, flow = nx.network_simplex(G)
    except nx.NetworkXUnfeasible:
        raise HTTPException(400, "Problema infactible: las capacidades no permiten satisfacer ofertas/demandas.")
    except nx.NetworkXUnbounded:
        raise HTTPException(400, "Problema no acotado.")
    det = [f"{u} → {v}: {f} unidades (costo unitario {G[u][v]['weight']})" for u in flow for v, f in flow[u].items() if f > 0]
    img = to_png(G, lambda u, v, d: f"{flow[u][v]}/{d['capacity']} · c={d['weight']}", lambda u, v: flow[u][v] > 0)
    return {"summary": f"Costo mínimo total = {cost}", "details": det, "image": img}
