# Plan: Método Simplex (Programación Lineal)

Agregar un quinto método de optimización: **método simplex** con iteraciones paso a paso (tablas), entrada en formato de matriz ampliada e imagen de la región factible cuando hay 2 variables.

## Decisiones acordadas con el usuario

- **Resultado**: iteraciones paso a paso — implementación propia de simplex en dos fases (Fase I para `>=` y `=`, Fase II para la función objetivo), mostrando cada tabla en `details`.
- **Entrada**: un solo campo de textarea con la tabla completa: primera línea = coeficientes de Z; siguientes líneas = restricción en formato `coef coef ... signo RHS` (ej. `6 4 <= 24`). Campo `select` aparte para Maximizar/Minimizar.
- **Imagen**: con exactamente 2 variables se grafica la región factible (matplotlib) y se resalta el vértice óptimo; con ≠ 2 variables → `image: null`.

## 1. Backend — `backend/main.py`

### 1.1 Helper de parsing `parse_pl(text)` (~línea 42, junto a los otros helpers)

- Divide en líneas no vacías; exige ≥ 2 (objetivo + ≥1 restricción).
- Línea 1 → coeficientes de Z (reusa `num()` por token, acepta espacios o comas).
- Resto → por línea: separa el token de signo (`<=`, `>=`, `=`, y variantes `≤`/`≥`); coeficientes antes, RHS después.
- Validaciones con `HTTPException(400, ...)` en español:
  - `"La primera línea debe contener los coeficientes de la función objetivo (ej: 5 4)."`
  - `f"Línea inválida, usa «coeficientes signo lado derecho» (ej: 6 4 <= 24): '{l}'"`
  - `"Signo inválido: usa <=, >= o =."`
  - `"Todas las filas deben tener la misma cantidad de variables que la función objetivo."`
  - `"Ingresa al menos una restricción."`
- Devuelve `(c, rows)` donde `rows = [(coef_list, sign, rhs)]`.

### 1.2 Helper de imagen `plot_feasible_region(c, rows, opt_point, mode)` (solo 2 variables)

- Recorta la caja acotante `[0,L]²` (L derivado de RHS/coeficientes, con tope) con el algoritmo de Sutherland–Hodgman contra cada semiplano (incluye `x,y ≥ 0`).
- Dibuja: región factible rellena (`#cfe3ff`), rectas de cada restricción, ejes, vértices, punto óptimo en rojo `#d62728` y recta de Z pasando por él.
- Reusa el patrón de `to_png` (`main.py:44–56`): `fig.savefig(BytesIO, png, dpi=110)`, `plt.close(fig)`, devuelve base64 sin prefijo.

### 1.3 Endpoint `@app.post("/api/simplex")`

Implementación propia de simplex con tabla (no `scipy.linprog`, para poder mostrar iteraciones):

1. `c, rows = parse_pl(...)`; si `mode == "Minimizar"` se optimiza `-c` y se invierte Z al final.
2. RHS negativo → multiplicar fila por −1 y voltear signo.
3. Estandarizar: `<=` → holgura +1; `>=` → excedente −1 + artificial; `=` → artificial.
4. **Fase I**: maximizar −Σartificiales. Si óptimo < 0 → `HTTPException(400, "Problema infactible: no existe solución que satisfaga todas las restricciones.")`. Eliminar columna de artificial básica (o regla de columna de la identidad).
5. **Fase II**: simplex estándar con regla de Bland como fallback anti-ciclado. Sin variable elegible con coef. positivo en fila Z → `HTTPException(400, "Problema no acotado: la función objetivo puede crecer sin límite.")`.
6. **Iteraciones en `details`**: por cada paso una sección con `Iteración k — entra: x1 · sale: s1`, la tabla alineada (`f"{v:9.3f}"`) incluyendo fila Z, más líneas finales: valores de variables de decisión y holguras, y `Z = ...` (en `summary`: `"Z óptimo = 20 · x1 = 4, x2 = 0"`).
7. Imagen: si `len(c) == 2` y el problema es factible y acotado → `plot_feasible_region(...)`; si no → `None`.

Respuesta respeta el contrato: `{"summary": str, "details": [str], "image": str|None}`.

## 2. Frontend — `frontend/src/App.jsx`

Nuevo objeto al final del array `METHODS` (`App.jsx:5–59`); nada más hay que tocar (render, estado y submit ya son genéricos):

- `id: "simplex"`, `label: "Método simplex"`, `endpoint: "/api/simplex"`.
- `theory`: párrafo divulgativo en español (explora los vértices de la región factible; cada iteración mejora Z sin salir de ella).
- `guide`: 4 pasos (línea 1 = Z; formatos de restricción; signos permitidos; variables ≥ 0 y Max/Min).
- `fields`:
  - `problem` — `type: "textarea"`, value por defecto: `"5 4\n6 4 <= 24\n1 2 <= 6"`.
  - `mode` — `type: "select"`, `options: ["Maximizar", "Minimizar"]`, value `"Maximizar"`.

## 3. Verificación

- Backend con el launcher `py` (no hay `python` en PATH; deps ya instaladas): snippet que llama directamente `assignment`-style a la función del endpoint con `Req(fields=...)` para casos: factible+óptimo (Z=20 en el ejemplo), `>=` con Fase I, infactible (400), no acotado (400), 1 variable (image null), 2 variables (image PNG no nula).
- Frontend: `npm run build` (única verificación disponible según AGENTS.md).
- Arrancar `py -m uvicorn main:app --port 8000` desde `backend/` y probar `POST /api/simplex` con `curl` para confirmar el flujo completo vía proxy.
