from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3

app = FastAPI(title="MediQ Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    conn = sqlite3.connect("mediQ.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT, query TEXT, result TEXT,
            language TEXT DEFAULT 'en',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

class SearchLog(BaseModel):
    type: str
    query: str
    result: Optional[str] = ""
    language: Optional[str] = "en"

@app.get("/")
def root():
    return {"message": "MediQ AI Running"}

@app.post("/history")
def save_history(log: SearchLog):
    conn = get_db()
    conn.execute("INSERT INTO search_history (type, query, result, language) VALUES (?, ?, ?, ?)",
        (log.type, log.query, log.result, log.language))
    conn.commit()
    conn.close()
    return {"message": "Saved"}

@app.get("/history")
def get_history(limit: int = 10):
    conn = get_db()
    rows = conn.execute("SELECT * FROM search_history ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/stats")
def get_stats():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) as c FROM search_history").fetchone()["c"]
    conn.close()
    return {"total_searches": total}