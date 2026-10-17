# Optimización en redes (FastAPI + React)

## Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

## Frontend (otra terminal)
cd frontend
npm install
npm run dev        # abre http://localhost:5173

Documentación automática de la API: http://localhost:8000/docs
