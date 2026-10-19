import { useEffect, useRef, useState } from "react";

// Cada método es un objeto: para agregar uno nuevo basta añadirlo aquí (y su endpoint en el backend).
// guide: pasos para ingresar el ejercicio · hint: ayuda breve asociada a cada campo.
const METHODS = [
  {
    id: "assignment", label: "Método de asignación", endpoint: "/api/assignment",
    theory: "Imagina que tienes varias personas y varias tareas, y sabes cuánto costaría (o cuánto ganaría) cada persona al realizar cada tarea. Este método te ayuda a decidir quién se encarga de qué, de modo que cada persona quede asignada a una sola tarea y el resultado global sea lo mejor posible: el costo más bajo o el beneficio más alto. Sirve para aprovechar bien los recursos y evitar combinaciones desfavorables.",
    guide: [
      "Escribe la matriz de costos con una fila por línea: cada fila es un agente y cada columna una tarea.",
      "Separa los números con espacios o comas; todas las filas deben tener la misma cantidad de columnas. Ejemplo: «9 2 7 8».",
      "Elige el objetivo con el que se evalúa la matriz: Minimizar (costos) o Maximizar (beneficios).",
    ],
    fields: [
      { name: "matrix", label: "Matriz de costos (una fila por línea)", type: "textarea", hint: "Una fila por línea · filas = agentes, columnas = tareas.", value: "9 2 7 8\n6 4 3 7\n5 8 1 8\n7 6 9 4" },
      { name: "mode", label: "Objetivo", type: "select", hint: "Minimizar costos o maximizar beneficios.", options: ["Minimizar", "Maximizar"], value: "Minimizar" },
    ],
  },
  {
    id: "km", label: "Método Kuhn-Munkres", endpoint: "/api/kuhn-munkres",
    theory: "Es una forma muy eficiente de resolver el mismo problema de asignación: encontrar la mejor combinación entre personas y tareas cuando hay muchas opciones para elegir. Aunque la tabla de costos sea grande, este método encuentra rápidamente la opción óptima. También funciona cuando hay más tareas que personas (o al revés), completando los espacios sobrantes sin afectar el resultado final.",
    guide: [
      "Escribe la matriz de costos con una fila por línea, igual que en el problema de asignación.",
      "Separa los números con espacios o comas; se admiten enteros y decimales.",
      "Si la matriz no es cuadrada, el método la completa con ceros: esas asignaciones ficticias no cuentan en el total.",
    ],
    fields: [
      { name: "matrix", label: "Matriz de costos (una fila por línea)", type: "textarea", hint: "Una fila por línea · filas = agentes, columnas = tareas.", value: "9 2 7 8\n6 4 3 7\n5 8 1 8\n7 6 9 4" },
    ],
  },
  {
    id: "maxflow", label: "Método de flujo máximo", endpoint: "/api/max-flow",
    theory: "Piensa en una red de caminos o tuberías que conectan un punto de origen con un destino final. Cada tramo tiene una capacidad máxima de lo que puede transportar. Este método calcula cuánta cantidad (productos, agua, mensajes, etc.) se puede enviar del origen al destino sin jamás exceder esas capacidades. Es útil para planificar transporte, logística o redes de comunicación y saber el máximo que se puede mover por la red.",
    guide: [
      "Escribe un arco por línea con el formato «origen destino capacidad», por ejemplo «s a 10».",
      "Los nodos se crean al nombrarlos en los arcos; sus nombres no deben contener espacios ni comas.",
      "Indica la fuente y el sumidero escribiéndolos igual que en los arcos (se distinguen mayúsculas de minúsculas).",
      "La capacidad de cada arco debe ser un número mayor que cero.",
    ],
    fields: [
      { name: "edges", label: "Arcos: origen destino capacidad", type: "textarea", hint: "Un arco por línea · formato: origen destino capacidad.", value: "s a 10\ns b 5\na b 15\na t 10\nb t 10" },
      { name: "source", label: "Nodo fuente", type: "text", hint: "Nombre exacto del nodo fuente tal como aparece en los arcos.", value: "s" },
      { name: "sink", label: "Nodo sumidero", type: "text", hint: "Nombre exacto del nodo sumidero tal como aparece en los arcos.", value: "t" },
    ],
  },
  {
    id: "mincost", label: "Método de flujo a costo mínimo", endpoint: "/api/min-cost-flow",
    theory: "Este método resuelve un problema de transporte: mover productos desde puntos que tienen mercancía disponible (oferta) hacia puntos que la necesitan (demanda). Cada ruta tiene un límite de cuánto se puede transportar por ella y un costo por cada unidad enviada. El objetivo es satisfacer todas las necesidades al costo total más bajo posible, eligiendo sabiamente por dónde enviar cada producto.",
    guide: [
      "Escribe un arco por línea con el formato «origen destino capacidad costo», por ejemplo «A C 10 2» (capacidad y costo numéricos).",
      "En oferta/demanda anota un nodo por línea con su valor: positivo = oferta, negativo = demanda; los nodos que no aparezcan valen 0.",
      "Cada nodo debe figurar en algún arco y la oferta total debe igualar a la demanda total, es decir, los valores suman 0 (en el ejemplo: 8 + 6 − 5 − 9 = 0).",
    ],
    fields: [
      { name: "edges", label: "Arcos: origen destino capacidad costo", type: "textarea", hint: "Un arco por línea · formato: origen destino capacidad costo.", value: "A C 10 2\nA D 10 4\nB C 10 3\nB D 10 1\nC D 5 1" },
      { name: "supplies", label: "Oferta(+)/Demanda(−): nodo valor (el resto vale 0)", type: "textarea", hint: "Un nodo por línea · formato: nodo valor.", value: "A 8\nB 6\nC -5\nD -9" },
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
  const errorRef = useRef(null);

  const select = (m) => { setActive(m); setResult(null); setError(""); };
  const setField = (name, value) => setForms({ ...forms, [active.id]: { ...forms[active.id], [name]: value } });

  const scrollBehavior = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
    }
  }, [result]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
    }
  }, [error]);

  async function solve() {
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(active.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: forms[active.id] }) });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch { /* respuesta no-JSON (p. ej. 500 en texto plano) */ }
      if (!res.ok) throw new Error(data.detail || "Error en el servidor");
      setResult(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="page">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="masthead">
        <div className="masthead-text">
          <h1 className="title">Aplicación de métodos de optimización</h1>
          <p className="tagline">Elige un método y sigue el paso a paso que describe cómo ingresar el ejercicio para obtener su solución.</p>
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

        <main className="panel" id="contenido" tabIndex={-1}>
          <section className="workbench">
            <h2 className="method-title">{active.label}</h2>
            <p className="theory">{active.theory}</p>

            <div className="guide">
              <h3 className="guide-title">Cómo ingresar el ejercicio</h3>
              <ol className="guide-list">
                {active.guide.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </div>

            <form className="form" aria-busy={loading} onSubmit={(e) => { e.preventDefault(); if (!loading) solve(); }}>
              {active.fields.map(f => {
                const id = `${active.id}-${f.name}`;
                const hintId = `${id}-hint`;
                return (
                  <div className="field" key={f.name}>
                    <label className="field-label" htmlFor={id}>{f.label}</label>
                    {f.type === "textarea" && (
                      <textarea
                        id={id}
                        className="field-input"
                        rows={6}
                        spellCheck="false"
                        autoComplete="off"
                        aria-describedby={hintId}
                        value={forms[active.id][f.name]}
                        onChange={e => setField(f.name, e.target.value)}
                      />
                    )}
                    {f.type === "text" && (
                      <input
                        id={id}
                        className="field-input field-input--text"
                        spellCheck="false"
                        autoComplete="off"
                        aria-describedby={hintId}
                        value={forms[active.id][f.name]}
                        onChange={e => setField(f.name, e.target.value)}
                      />
                    )}
                    {f.type === "select" && (
                      <select
                        id={id}
                        className="field-select"
                        aria-describedby={hintId}
                        value={forms[active.id][f.name]}
                        onChange={e => setField(f.name, e.target.value)}
                      >
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    <p className="field-hint" id={hintId}>{f.hint}</p>
                  </div>
                );
              })}
              <button className="solve" type="submit" disabled={loading}>
                {loading ? "Calculando…" : "Resolver"}
              </button>
            </form>
          </section>

          {error && (
            <div className="message" role="alert" ref={errorRef}>
              <p>{error}</p>
            </div>
          )}

          <div className="result-slot" role="status">
            {result && (
              <section className="result" ref={resultRef} aria-labelledby="result-title">
                <h3 className="result-summary" id="result-title">{result.summary}</h3>
                <pre className="result-details">{result.details.join("\n")}</pre>
                {result.image && (
                  <figure className="plot">
                    <img src={`data:image/png;base64,${result.image}`} alt={`Grafo de la red de la solución: ${result.summary}`} />
                    <figcaption>Cada arco indica el flujo obtenido sobre su capacidad y, cuando aplica, el costo unitario.</figcaption>
                  </figure>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
