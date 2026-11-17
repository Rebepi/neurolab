import json
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.database import get_db

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

class ProjectCreate(BaseModel):
    name: str
    description: str
    owner_id: str
    tags: Optional[List[str]] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None

class MemberAdd(BaseModel):
    user_id: str
    role: str

@router.get("")
def list_projects(q: Optional[str] = None, status: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT p.id, p.name, p.description, p.owner_id, p.status, p.tags, p.created_at, p.updated_at,
               u.display_name as owner_name,
               (SELECT COUNT(*) FROM training_jobs tj WHERE tj.project_id = p.id) as jobs_count,
               (SELECT COUNT(*) FROM model_versions mv WHERE mv.project_id = p.id) as models_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        WHERE 1=1
    """
    params = []
    if q:
        query += " AND (p.name LIKE ? OR p.description LIKE ?)"
        params.extend([f"%{q}%", f"%{q}%"])
    if status:
        query += " AND p.status = ?"
        params.append(status)

    query += " ORDER BY p.updated_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()

    results = []
    for r in rows:
        d = dict(r)
        d["tags"] = json.loads(d["tags"]) if d["tags"] else []
        results.append(d)

    conn.close()
    return results

@router.post("")
def create_project(req: ProjectCreate):
    conn = get_db()
    cursor = conn.cursor()
    project_id = f"prj-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()
    tags_json = json.dumps(req.tags or [])

    cursor.execute("SELECT id, display_name FROM users WHERE id = ?", (req.owner_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuario propietario no encontrado")

    cursor.execute(
        "INSERT INTO projects (id, name, description, owner_id, status, tags, created_at, updated_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)",
        (project_id, req.name, req.description, req.owner_id, tags_json, now, now)
    )

    mem_id = f"mem-{uuid.uuid4().hex[:8]}"
    cursor.execute(
        "INSERT INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, 'Responsable de proyecto', ?)",
        (mem_id, project_id, req.owner_id, now)
    )

    audit_id = f"aud-{uuid.uuid4().hex[:8]}"
    cursor.execute(
        "INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at) VALUES (?, ?, ?, ?, 'PROJECT_CREATED', ?, ?)",
        (audit_id, req.owner_id, user["display_name"], project_id, json.dumps({"name": req.name}), now)
    )

    conn.commit()
    conn.close()
    return {
        "id": project_id,
        "name": req.name,
        "description": req.description,
        "owner_id": req.owner_id,
        "status": "ACTIVE",
        "tags": req.tags or [],
        "created_at": now,
        "updated_at": now
    }

@router.get("/{project_id}")
def get_project(project_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, u.display_name as owner_name, u.email as owner_email
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        WHERE p.id = ?
    """, (project_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    proj = dict(row)
    proj["tags"] = json.loads(proj["tags"]) if proj["tags"] else []

    cursor.execute("""
        SELECT pm.id, pm.role, pm.created_at, u.id as user_id, u.display_name, u.email
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ?
    """, (project_id,))
    members = [dict(m) for m in cursor.fetchall()]
    proj["members"] = members

    cursor.execute("SELECT COUNT(*) FROM datasets WHERE project_id = ?", (project_id,))
    proj["datasets_count"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM architectures WHERE project_id = ?", (project_id,))
    proj["architectures_count"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM training_jobs WHERE project_id = ?", (project_id,))
    proj["jobs_count"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM model_versions WHERE project_id = ?", (project_id,))
    proj["models_count"] = cursor.fetchone()[0]

    conn.close()
    return proj

@router.put("/{project_id}")
def update_project(project_id: str, req: ProjectUpdate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    now = datetime.utcnow().isoformat()
    name = req.name if req.name is not None else row["name"]
    desc = req.description if req.description is not None else row["description"]
    stat = req.status if req.status is not None else row["status"]
    tags_json = json.dumps(req.tags) if req.tags is not None else row["tags"]

    cursor.execute(
        "UPDATE projects SET name = ?, description = ?, status = ?, tags = ?, updated_at = ? WHERE id = ?",
        (name, desc, stat, tags_json, now, project_id)
    )
    conn.commit()
    conn.close()
    return {"id": project_id, "name": name, "description": desc, "status": stat, "updated_at": now}

@router.delete("/{project_id}")
def delete_project(project_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": project_id}

@router.post("/{project_id}/members")
def add_member(project_id: str, req: MemberAdd):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (req.user_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    mem_id = f"mem-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()
    try:
        cursor.execute(
            "INSERT INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (mem_id, project_id, req.user_id, req.role, now)
        )
        conn.commit()
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail="El usuario ya es miembro de este proyecto")

    conn.close()
    return {"id": mem_id, "project_id": project_id, "user_id": req.user_id, "role": req.role}

@router.delete("/{project_id}/members/{user_id}")
def remove_member(project_id: str, user_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM project_members WHERE project_id = ? AND user_id = ?", (project_id, user_id))
    conn.commit()
    conn.close()
    return {"status": "removed"}

