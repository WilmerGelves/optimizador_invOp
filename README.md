# Optimizador de Inventarios y Operaciones

Aplicación web para resolver y visualizar clásicos problemas de **optimización en redes**. El usuario ingresa una matriz o una lista de arcos, elige un método y la app devuelve el resultado numérico, el detalle paso a paso y (cuando aplica) un gráfico de la red con el flujo o la asignación resaltada.

## Descripción del proyecto

La app está compuesta por dos partes:

| Parte | Tecnología | Carpeta | Corre en |
|-------|-----------|---------|----------|
| Backend / API | FastAPI + SciPy + NetworkX + Matplotlib | `backend/` | `http://localhost:8000` |
| Frontend | React 18 + Vite 5 | `frontend/` | `http://localhost:5173` |

### Métodos disponibles

| Método | Endpoint | Qué resuelve |
|--------|----------|--------------|
| Método de asignación | `POST /api/assignment` | Asignación óptima agentes ↔ tareas minimizando costos o maximizando beneficios (`scipy.optimize.linear_sum_assignment`). |
| Kuhn-Munkres | `POST /api/kuhn-munkres` | Asignación óptima con implementación propia (minimiza, matriz cuadrada con relleno de ceros) y reporta los potenciales duales `u`, `v`. |
| Flujo máximo | `POST /api/max-flow` | Valor del flujo máximo entre fuente y sumidero, flujo por arco y corte mínimo (Ford-Fulkerson / Dinic de NetworkX). |
| Flujo a costo mínimo | `POST /api/min-cost-flow` | Flujo que satisface ofertas y demandas al menor costo total (algoritmo network simplex de NetworkX). |

### Estructura del repositorio

```
optimizador_invOp/
├── backend/
│   ├── main.py          # Toda la API, el parsing y el dibujo de grafos
│   └── requirements.txt
├── frontend/
│   ├── src/App.jsx      # Una sola página: registro de métodos y formulario
│   ├── src/main.jsx
│   ├── src/styles.css
│   ├── index.html
│   └── vite.config.js   # Proxy de /api -> localhost:8000
├── AGENTS.md
└── README.md
```

---

## Cómo clonarlo y correrlo

### Requisitos

- Python 3.10+
- Node.js 18+ (con npm)

### 1. Clonar el repositorio

```bash
git clone https://github.com/WilmerGelves/optimizador_invOp.git
cd optimizador_invOp
```

### 2. Levantar el backend (terminal 1)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- API en vivo: `http://localhost:8000`
- Documentación interactiva (Swagger): `http://localhost:8000/docs`

### 3. Levantar el frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Abrir **`http://localhost:5173`** en el navegador.

> El backend **debe** correr en el puerto `8000`: `frontend/vite.config.js` proxea `/api` hacia `http://localhost:8000`, así que el navegador nunca habla con el backend directamente.

---

## Cómo funciona

### Flujo general

```
Navegador (React)                     Backend (FastAPI)
─────────────────                     ─────────────────
Elige un método  ──POST /api/...──►  { "fields": { ...campos del formulario... } }
                     ◄──────────────  { summary, details, image }
Muestra resumen,
lista de detalles
y la imagen PNG
```

1. **Frontend**: `src/App.jsx` define un array `METHODS`, donde cada método declara sus campos (texto, área de texto, select), una descripción teórica y su endpoint. Al enviar el formulario hace `fetch` con `POST {"fields": {...}}` a la ruta relativa `/api/...`.
2. **Proxy de Vite**: redirige cualquier `/api` al backend en el puerto 8000; por eso en el código del cliente nunca aparece `http://localhost:8000`.
3. **Backend**: recibe el JSON en `backend/main.py`, valida y parsea la entrada, ejecuta el algoritmo y responde siempre con el mismo contrato:
   ```json
   { "summary": "texto del resultado", "details": ["línea 1", "línea 2"], "image": "base64 PNG" | null }
   ```
   `image` es un PNG en base64 (o `null`) generado con Matplotlib en modo `Agg`; `details` es siempre una lista de strings, porque el frontend hace `details.join("\n")`.
4. **Frontend**: pinta el resumen, los detalles y, si hay imagen, la muestra en pantalla.

### Entrada de datos

- **Matrices** (asignación y Kuhn-Munkres): una fila por línea, números separados por espacios o comas y mismo largo en todas las filas. Se procesan con `parse_matrix`.
- **Arcos** (flujos): una línea por arco. Flujo máximo: `origen destino capacidad`. Flujo a costo mínimo: `origen destino capacidad costo`. Se procesan con `parse_edges`.
- **Ofertas/demandas**: una línea por nodo, `nodo valor` (positivo = oferta, negativo = demanda, el resto vale 0).

### Manejo de errores

Cualquier entrada inválida devuelve `HTTPException(400, "mensaje en español")`; el frontend muestra `data.detail` tal cual. Ejemplos: matriz con filas de distinto largo, capacidad ≤ 0, fuente igual a sumidero, red infactible.

### Ejecución de un método (ejemplo: flujo máximo)

1. Se construye un `nx.DiGraph` con capacidades desde los arcos.
2. `nx.maximum_flow` calcula el flujo máximo y `nx.minimum_cut` el corte mínimo.
3. La red se dibuja con `nx.spring_layout(G, seed=3)` (seed fijo para que las imágenes sean siempre iguales); los arcos con flujo > 0 se resaltan en rojo y cada arco muestra `flujo/capacidad`.
4. La figura se serializa a PNG base64 y se devuelve en `image`.

### Cómo agregar un nuevo método

1. Añadir un objeto al array `METHODS` en `frontend/src/App.jsx` (campos, teoría y endpoint).
2. Crear el endpoint `@app.post("/api/...")` en `backend/main.py` que devuelva `{summary, details, image}`.

No hay registro dinámico ni archivos por método: ambos cambios son suficientes.
