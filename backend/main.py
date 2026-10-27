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

def parse_pl(text):
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    if len(lines) < 2:
        raise HTTPException(400, "El problema necesita la función objetivo (1ª línea) y al menos una restricción.")
    try:
        c = [float(x) for x in lines[0].replace(",", " ").split()]
    except ValueError:
        raise HTTPException(400, "La primera línea debe contener los coeficientes de la función objetivo (ej: 5 4).")
    if not c:
        raise HTTPException(400, "La primera línea debe contener los coeficientes de la función objetivo (ej: 5 4).")
    rows = []
    for l in lines[1:]:
        toks = l.replace(",", " ").split()
        sign = next((s for s in ("<=", ">=", "=", "≤", "≥") if s in toks), None)
        if sign is None:
            raise HTTPException(400, f"Línea inválida, usa «coeficientes signo lado derecho» (ej: 6 4 <= 24): '{l}'")
        k = toks.index(sign)
        a, rest = toks[:k], toks[k + 1:]
        if len(rest) != 1:
            raise HTTPException(400, f"Línea inválida, usa «coeficientes signo lado derecho» (ej: 6 4 <= 24): '{l}'")
        if len(a) != len(c):
            raise HTTPException(400, f"La restricción debe tener la misma cantidad de variables que el objetivo: '{l}'")
        try:
            coeffs = [float(x) for x in a]
            rhs = float(rest[0])
        except ValueError:
            raise HTTPException(400, f"Número inválido en: '{l}'")
        rows.append((coeffs, {"≤": "<=", "≥": ">="}.get(sign, sign), rhs))
    return c, rows

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

def _clip_half(poly, a1, a2, rhs):
    # mantiene a1*x + a2*y <= rhs (recorte Sutherland-Hodgman)
    out = []
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        fp, fq = a1 * p[0] + a2 * p[1] - rhs, a1 * q[0] + a2 * q[1] - rhs
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out

def plot_feasible_region(c, rows, x_opt, z_opt):
    L = 10.0
    for coeffs, _, rhs in rows:
        for a in coeffs:
            if abs(a) > 1e-12:
                L = max(L, 2.0 * abs(rhs) / abs(a))
    L = min(max(L, 1.2 * max(x_opt) if x_opt else L), 10000.0)
    poly = [(0, 0), (L, 0), (L, L), (0, L)]
    for coeffs, sign, rhs in rows:
        a1, a2 = coeffs
        if sign == ">=":
            a1, a2, rhs = -a1, -a2, -rhs
        poly = _clip_half(poly, a1, a2, rhs)
    fig, ax = plt.subplots(figsize=(7, 5))
    if poly:
        xs, ys = zip(*poly)
        ax.fill(xs, ys, color="#cfe3ff", alpha=0.75, zorder=1)
        ax.plot([*xs, xs[0]], [*ys, ys[0]], color="#0E7C86", lw=1.3, zorder=2)
    x = np.linspace(0, L, 400)
    for coeffs, _, rhs in rows:
        a1, a2 = coeffs
        if abs(a2) > 1e-12:
            ax.plot(x, (rhs - a1 * x) / a2, color="#5E6E76", lw=1, ls="--", zorder=3)
        elif abs(a1) > 1e-12:
            ax.axvline(rhs / a1, color="#5E6E76", lw=1, ls="--", zorder=3)
    a1, a2 = c
    if abs(a2) > 1e-12:
        ax.plot(x, (z_opt - a1 * x) / a2, color="#C25E1B", lw=1.5, zorder=4)
    elif abs(a1) > 1e-12:
        ax.axvline(z_opt / a1, color="#C25E1B", lw=1.5, zorder=4)
    for vx, vy in poly:
        ax.plot([vx], [vy], "o", color="#0E7C86", ms=4, zorder=4)
    ax.plot([x_opt[0]], [x_opt[1]], "o", color="#d62728", ms=9, zorder=5)
    ax.annotate(f"Óptimo ({x_opt[0]:g}, {x_opt[1]:g})", (x_opt[0], x_opt[1]),
                textcoords="offset points", xytext=(8, 8), color="#d62728", fontsize=10, fontweight="bold")
    ax.set_xlim(0, L)
    ax.set_ylim(0, L)
    ax.set_xlabel("x1")
    ax.set_ylabel("x2")
    ax.set_title(f"Región factible y vértice óptimo · Z = {z_opt:g}")
    ax.grid(alpha=0.25, zorder=0)
    ax.axhline(0, color="#333", lw=1)
    ax.axvline(0, color="#333", lw=1)
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

# ---------- Simplex en dos fases (implementación propia, muestra iteraciones) ----------
def pl_solve(c, rows):
    eps = 1e-9
    n = len(c)
    col_names = [f"x{j+1}" for j in range(n)]
    A, b, basis, art_cols = [], [], [], []
    ns = na = extras = 0
    for coeffs, sign, rhs in rows:
        vals = [float(v) for v in coeffs]
        if rhs < 0:
            vals = [-v for v in vals]
            rhs = -rhs
            sign = {"<=": ">=", ">=": "<=", "=": "="}[sign]
        row = vals + [0.0] * extras  # ceros de las columnas extras de filas anteriores
        if sign != "=":
            ns += 1
            col_names.append(f"s{ns}")
            row.append(1.0 if sign == "<=" else -1.0)
        if sign != "<=":
            na += 1
            col_names.append(f"a{na}")
            row.append(1.0)
            art_cols.append(len(col_names) - 1)
        basis.append(len(col_names) - 1)
        extras = len(col_names) - n
        A.append(row)
        b.append(rhs)
    art_set = set(art_cols)
    m, N = len(A), len(col_names)
    # cada fila solo cargó sus propias columnas de holgura/artificial; el resto son ceros
    T = [A[i] + [0.0] * (N - len(A[i])) + [float(b[i])] for i in range(m)]
    o = []

    def fv(v):
        return 0.0 if abs(v) < eps else v

    def table_lines():
        w = 10
        lines = [f"{'B':>6}" + "".join(f"{nm:>{w}}" for nm in col_names) + f"{'b':>12}"]
        for i in range(m):
            lines.append(f"{col_names[basis[i]]:>6}" + "".join(f"{fv(T[i][j]):{w}.3f}" for j in range(N)) + f"{fv(T[i][N]):12.3f}")
        lines.append(f"{'Z':>6}" + "".join(f"{fv(o[j]):{w}.3f}" for j in range(N)) + f"{fv(o[N]):12.3f}")
        return lines

    def pivot(j_in, i_row):
        piv = T[i_row][j_in]
        T[i_row] = [v / piv for v in T[i_row]]
        for i in range(m):
            if i != i_row and abs(T[i][j_in]) > eps:
                f = T[i][j_in]
                T[i] = [T[i][k] - f * T[i_row][k] for k in range(N + 1)]
        f = o[j_in]
        if abs(f) > eps:
            o[:] = [o[k] - f * T[i_row][k] for k in range(N + 1)]

    def run(c_ext, det, tag, intro):
        o[:] = [sum(c_ext[basis[i]] * T[i][j] for i in range(m)) - c_ext[j] for j in range(N)]
        o.append(sum(c_ext[basis[i]] * T[i][N] for i in range(m)))
        det += [intro, *table_lines()]
        bland, k = False, 0
        while True:
            # fila Z guarda (z_j - c_j): para maximizar entra la más negativa
            neg = [j for j in range(N) if o[j] < -eps]
            if not neg:
                return
            if not bland:
                j_in = min(neg, key=lambda j: o[j])
                k += 1
                if k > 10 * (N + m):
                    bland = True
            if bland:
                j_in = min(neg)
            ratios = [(T[i][N] / T[i][j_in], basis[i], i) for i in range(m) if T[i][j_in] > eps]
            if not ratios:
                raise HTTPException(400, "Problema no acotado: la función objetivo no tiene límite en la dirección de mejora.")
            min_r = min(r[0] for r in ratios)
            i_row = min(r for r in ratios if abs(r[0] - min_r) <= eps)[2]
            entra, sale = col_names[j_in], col_names[basis[i_row]]
            pivot(j_in, i_row)
            basis[i_row] = j_in
            det += ["", f"{tag} · iteración {k} — entra: {entra} · sale: {sale}", *table_lines()]

    det = []
    if art_cols:
        c1 = [-1.0 if j in art_set else 0.0 for j in range(N)]
        run(c1, det, "Fase I", "Fase I — se minimiza la suma de variables artificiales para encontrar una solución factible:")
        if o[N] < -1e-7:
            raise HTTPException(400, "Problema infactible: no existe solución que satisfaga todas las restricciones.")
        # artificiales en la base: pivotar a una columna real o eliminar fila redundante
        redundant = []
        for i in range(m):
            if basis[i] in art_set:
                nz = [j for j in range(N) if j not in art_set and abs(T[i][j]) > eps]
                if nz:
                    pivot(nz[0], i)
                    basis[i] = nz[0]
                else:
                    redundant.append(i)
        if redundant:
            T = [T[i] for i in range(m) if i not in redundant]
            basis = [basis[i] for i in range(m) if i not in redundant]
            m = len(T)
        keep = [j for j in range(N) if j not in art_set]
        T = [[T[i][j] for j in keep] + [T[i][N]] for i in range(m)]
        col_names = [col_names[j] for j in keep]
        remap = {old: new for new, old in enumerate(keep)}
        basis = [remap[j] for j in basis]
        N = len(col_names)
    c2 = [c[j] if j < n else 0.0 for j in range(N)]
    run(c2, det, "Fase II", "Fase II — se optimiza la función objetivo sobre la región factible:")
    x = [0.0] * n
    for i, bi in enumerate(basis):
        if bi < n:
            x[bi] = T[i][N]
    slacks = []
    for j in range(n, N):
        val = T[basis.index(j)][N] if j in basis else 0.0
        slacks.append((col_names[j], val))
    return x, slacks, o[N], det

@app.post("/api/simplex")
def simplex(r: Req):
    c, rows = parse_pl(r.fields.get("problem") or "")
    mx = r.fields.get("mode") != "Minimizar"
    csolve = [v if mx else -v for v in c]
    x, slacks, z_raw, det = pl_solve(csolve, rows)
    z = (z_raw if mx else -z_raw) + 0.0  # + 0.0 evita mostrar "-0"
    x = [v + 0.0 for v in x]
    det += ["", "Solución óptima (variables de decisión):"]
    det += [f"x{j+1} = {fv:g}" for j, fv in enumerate(x)]
    det += ["", "Variables de holgura/excedente:"] + [f"{nm} = {v:g}" for nm, v in slacks]
    det += [f"Z = {z:g}"]
    summary = f"Z óptimo = {z:g} · " + ", ".join(f"x{j+1} = {v:g}" for j, v in enumerate(x))
    img = plot_feasible_region(c, rows, x, z) if len(c) == 2 else None
    return {"summary": summary, "details": det, "image": img}
