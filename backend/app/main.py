from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Import the routers
from app.agents.librarian.router import router as librarian_router
from app.agents.architect.router import router as architect_router # <-- ADD THIS
from app.agents.guardian.router import router as guardian_router
from app.agents.mentor.router import router as mentor_router
from app.core.alerts import alert_system

app = FastAPI(title="KA-CHOW Enterprise Brain", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Agents
app.include_router(librarian_router, prefix="/api/librarian", tags=["The Librarian"])
app.include_router(architect_router, prefix="/api/architect", tags=["The Architect"]) # <-- ADD THIS
app.include_router(guardian_router, prefix="/api/guardian", tags=["The Guardian"])
app.include_router(mentor_router, prefix="/api/v1/mentor", tags=["The Mentor"])

app.mount("/demo", StaticFiles(directory="app/static", html=True), name="static")

@app.get("/")
def root():
    return {"system_status": "ONLINE", "agents": ["Librarian", "Architect", "Mentor", "Guardian"]}

@app.get("/api/alerts")
def get_alerts():
    return alert_system.get_alerts()
@app.post('/api/alerts/{alert_id}/read')
def mark_alert_read(alert_id: int):
    alert_system.mark_read(alert_id)
    return {'ok': True}

@app.post('/api/alerts/read-all')
def mark_all_alerts_read():
    alert_system.mark_all_read()
    return {'ok': True}

@app.delete('/api/alerts')
def clear_all_alerts():
    alert_system.clear()
    return {'ok': True}
