# AGENTS.md

## Estructura

- `backend/` — FastAPI, todo en un solo archivo: `main.py`. Sin tests, sin lint, sin empaquetado (no es un módulo installable; se corre con `uvicorn main:app` desde `backend/`).
- `frontend/` — React 18 + Vite 5 (`"type": "module"`), una sola página en `src/App.jsx`.

## Comandos (no hay atajos: son estos exactamente)

Backend (terminal 1):
```
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend (terminal 2):
```
cd frontend
npm install
npm run dev        # http://localhost:5173
```

No existen comandos de lint, typecheck ni tests. `npm run build` es la única verificación de frontend.

## Convenciones no obvias

- **El proxy importa**: `frontend/vite.config.js` proxea `/api` → `http://localhost:8000`. El frontend llama a rutas relativas (`/api/...`); nunca poner `http://localhost:8000` en el código del cliente. El backend debe correr en el puerto 8000.
- **Agregar un método de optimización** = añadir un objeto al array `METHODS` en `src/App.jsx` (campos, theory, endpoint) y crear el endpoint `@app.post("/api/...")` en `backend/main.py`. No hay registro dinámico ni archivos por método.
- **Contrato de API**: todos los endpoints aceptan `POST {"fields": {...}}` y devuelven `{summary: str, details: string[], image: str|null}`. `image` es PNG en base64 (o `None`, que en JSON es `null`); el frontend hace `result.details.join("\n")`, así que `details` debe ser siempre lista de strings.
- **Errores**: se devuelven con `HTTPException(400, "mensaje en español")`; el frontend muestra `data.detail`. Todos los mensajes/UI están en español — mantener ese idioma.
- **Parsing de entrada**: matrices y arcos se envían como texto (una fila/línea por línea, separadores espacio o coma) y se parsean con `parse_matrix` / `parse_edges` en `main.py`. Reusar esas funciones en vez de reparsear.
- **Matplotlib**: usar siempre `matplotlib.use("Agg")` (ya está al inicio de `main.py`) — no hay display. Cerrar figuras con `plt.close(fig)` (ya lo hace `to_png`).
- **Kuhn-Munkres es implementación propia** (`kuhn_munkres` en `main.py`, minimiza, matriz cuadrada con padding de ceros), distinta de `/api/assignment` que usa `scipy.optimize.linear_sum_assignment`. No sustituir una por la otra.
- Layout de grafos con `nx.spring_layout(G, seed=3)` — el seed fijo es intencional (imágenes deterministas).
