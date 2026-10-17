import { useEffect, useRef, useState } from "react";

// Cada método es un objeto: para agregar uno nuevo basta añadirlo aquí (y su endpoint en el backend).
const METHODS = [
  {
    id: "assignment", label: "Problema de asignación", endpoint: "/api/assignment",
    theory: "Dado un conjunto de n agentes y n tareas, y una matriz de costos (o beneficios) c[i][j], se busca asignar cada agente a exactamente una tarea (y viceversa) de modo que el costo total sea mínimo (o el beneficio máximo). Es un caso particular del problema de transporte y de flujo a costo mínimo, con matriz de 0-1 como variables de decisión.",
    fields: [
      { name: "matrix", label: "Matriz de costos (una fila por línea)", type: "textarea", value: "9 2 7 8\n6 4 3 7\n5 8 1 8\n7 6 9 4" },
      { name: "mode", label: "Objetivo", type: "select", options: ["Minimizar", "Maximizar"], value: "Minimizar" },
    ],
  },
  {
    id: "km", label: "Método Kuhn-Munkres", endpoint: "/api/kuhn-munkres",
    theory: "También llamado método húngaro. Resuelve el problema de asignación en O(n³) usando dualidad: mantiene potenciales u (filas) y v (columnas) tales que u[i]+v[j] ≤ c[i][j]. Busca un emparejamiento perfecto en el subgrafo de aristas 'ajustadas' (u[i]+v[j]=c[i][j]); si no existe, ajusta los potenciales con el menor holgura (delta) y repite. Al terminar, el costo óptimo es Σu + Σv. Si la matriz no es cuadrada, se rellena con ceros.",
    fields: [
      { name: "matrix", label: "Matriz de costos (una fila por línea)", type: "textarea", value: "9 2 7 8\n6 4 3 7\n5 8 1 8\n7 6 9 4" },
    ],
  },
  {
    id: "maxflow", label: "Flujo máximo", endpoint: "/api/max-flow",
    theory: "En una red dirigida con capacidades en los arcos, una fuente s y un sumidero t, se busca la mayor cantidad de flujo que puede enviarse de s a t respetando capacidades y la conservación del flujo en los nodos intermedios. Por el teorema del flujo máximo – corte mínimo, su valor iguala la capacidad del corte s-t de menor capacidad. Se resuelve con Ford-Fulkerson, Edmonds-Karp o Dinic.",
    fields: [
      { name: "edges", label: "Arcos: origen destino capacidad", type: "textarea", value: "s a 10\ns b 5\na b 15\na t 10\nb t 10" },
      { name: "source", label: "Nodo fuente", type: "text", value: "s" },
      { name: "sink", label: "Nodo sumidero", type: "text", value: "t" },
    ],
  },
  {
    id: "mincost", label: "Flujo a costo mínimo", endpoint: "/api/min-cost-flow",
    theory: "En una red con capacidades, costos unitarios por arco y nodos con oferta (positiva) o demanda (negativa), se busca el flujo factible que satisfaga todas las ofertas y demandas con costo total mínimo. Generaliza asignación, transporte, transbordo, camino más corto y flujo máximo. Se resuelve con el simplex para redes o con algoritmos de cancelación de ciclos / caminos de aumento sucesivos.",
    fields: [
      { name: "edges", label: "Arcos: origen destino capacidad costo", type: "textarea", value: "A C 10 2\nA D 10 4\nB C 10 3\nB D 10 1\nC D 5 1" },
      { name: "supplies", label: "Oferta(+)/Demanda(−): nodo valor (el resto vale 0)", type: "textarea", value: "A 8\nB 6\nC -5\nD -9" },
    ],
  },
];

function NetMark() {
  return (
    <svg className="netmark" viewBox="0 0 168 88" aria-hidden="true" focusable="false">
      <defs>
        <marker id="nm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 Z" fill="#0E7C86" opacity="0.75" />
        </marker>
        <marker id="nm-arrow-mark" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 Z" fill="#C25E1B" />
        </marker>
      </defs>
      <line x1="19" y1="48" x2="53" y2="67" stroke="#0E7C86" strokeOpacity="0.5" strokeWidth="1.5" markerEnd="url(#nm-arrow)" />
      <line x1="62" y1="24" x2="62" y2="61" stroke="#0E7C86" strokeOpacity="0.5" strokeWidth="1.5" markerEnd="url(#nm-arrow)" />
      <line x1="70" y1="70" x2="146" y2="47" stroke="#0E7C86" strokeOpacity="0.5" strokeWidth="1.5" markerEnd="url(#nm-arrow)" />
      <line x1="19" y1="40" x2="53" y2="21" stroke="#C25E1B" strokeWidth="2.25" markerEnd="url(#nm-arrow-mark)" />
      <line x1="70" y1="18" x2="146" y2="41" stroke="#C25E1B" strokeWidth="2.25" markerEnd="url(#nm-arrow-mark)" />
      <circle cx="12" cy="44" r="7" fill="#0B4A52" />
      <circle cx="62" cy="16" r="7" fill="#FFFFFF" stroke="#C25E1B" strokeWidth="2" />
      <circle cx="62" cy="72" r="7" fill="#FFFFFF" stroke="#0E7C86" strokeWidth="1.8" />
      <circle cx="156" cy="44" r="7" fill="#0B4A52" />
      <text x="12" y="62" textAnchor="middle" fontSize="9.5" fontFamily="'IBM Plex Mono', monospace" fill="#5E6E76">s</text>
      <text x="62" y="9" textAnchor="middle" fontSize="9.5" fontFamily="'IBM Plex Mono', monospace" fill="#5E6E76">a</text>
      <text x="62" y="87" textAnchor="middle" fontSize="9.5" fontFamily="'IBM Plex Mono', monospace" fill="#5E6E76">b</text>
      <text x="156" y="62" textAnchor="middle" fontSize="9.5" fontFamily="'IBM Plex Mono', monospace" fill="#5E6E76">t</text>
    </svg>
  );
}

export default function App() {
  const [active, setActive] = useState(METHODS[0]);
  const [forms, setForms] = useState(() => Object.fromEntries(METHODS.map(m => [m.id, Object.fromEntries(m.fields.map(f => [f.name, f.value]))])));
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resultRef = useRef(null);

  const select = (m) => { setActive(m); setResult(null); setError(""); };
  const setField = (name, value) => setForms({ ...forms, [active.id]: { ...forms[active.id], [name]: value } });

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [result]);

  async function solve() {
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(active.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: forms[active.id] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error en el servidor");
      setResult(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead-text">
          <h1 className="title">Optimizador de redes</h1>
          <p className="tagline">Escribe el problema como texto, elige el método y obtén la solución numérica con su grafo.</p>
        </div>
        <NetMark />
      </header>

      <div className="layout">
        <nav className="rail" aria-label="Métodos de optimización">
          <h2 className="rail-title">Métodos</h2>
          <ul className="method-list">
            {METHODS.map(m => (
              <li key={m.id}>
                <button
                  type="button"
                  className={`method${m.id === active.id ? " is-active" : ""}`}
                  aria-pressed={m.id === active.id}
                  onClick={() => select(m)}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="panel">
          <section className="workbench">
            <h2 className="method-title">{active.label}</h2>
            <p className="theory">{active.theory}</p>

            <form className="form" onSubmit={(e) => { e.preventDefault(); if (!loading) solve(); }}>
              {active.fields.map(f => (
                <div className="field" key={f.name}>
                  <label className="field-label" htmlFor={`${active.id}-${f.name}`}>{f.label}</label>
                  {f.type === "textarea" && (
                    <textarea
                      id={`${active.id}-${f.name}`}
                      className="field-input"
                      rows={6}
                      spellCheck="false"
                      value={forms[active.id][f.name]}
                      onChange={e => setField(f.name, e.target.value)}
                    />
                  )}
                  {f.type === "text" && (
                    <input
                      id={`${active.id}-${f.name}`}
                      className="field-input field-input--text"
                      spellCheck="false"
                      value={forms[active.id][f.name]}
                      onChange={e => setField(f.name, e.target.value)}
                    />
                  )}
                  {f.type === "select" && (
                    <select
                      id={`${active.id}-${f.name}`}
                      className="field-select"
                      value={forms[active.id][f.name]}
                      onChange={e => setField(f.name, e.target.value)}
                    >
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              ))}
              <button className="solve" type="submit" disabled={loading}>
                {loading ? "Calculando…" : "Resolver"}
              </button>
            </form>
          </section>

          {error && (
            <div className="message" role="alert">
              <p>{error}</p>
            </div>
          )}

          {result && (
            <section className="result" ref={resultRef} aria-live="polite">
              <h3 className="result-summary">{result.summary}</h3>
              <pre className="result-details">{result.details.join("\n")}</pre>
              {result.image && (
                <figure className="plot">
                  <img src={`data:image/png;base64,${result.image}`} alt="Grafo de la solución" />
                </figure>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
