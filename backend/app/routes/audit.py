import json
from typing import Optional
from fastapi import APIRouter
from app.database import get_db

router = APIRouter(prefix="/api/v1", tags=["audit"])

@router.get("/projects/{project_id}/audit-events")
def list_project_audit(project_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, actor_id, actor_name, project_id, action, metadata_json, created_at
        FROM audit_events
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT 100
    """, (project_id,))
    rows = cursor.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["metadata"] = json.loads(d["metadata_json"]) if d["metadata_json"] else {}
        del d["metadata_json"]
        results.append(d)
    conn.close()
    return results

@router.get("/audit-events")
def list_all_audit(limit: int = 50, action: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    query = "SELECT id, actor_id, actor_name, project_id, action, metadata_json, created_at FROM audit_events"
    params = []
    if action:
        query += " WHERE action = ?"
        params.append(action)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["metadata"] = json.loads(d["metadata_json"]) if d["metadata_json"] else {}
        del d["metadata_json"]
        results.append(d)
    conn.close()
    return results

