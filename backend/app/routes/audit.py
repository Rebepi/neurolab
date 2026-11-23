import json
from typing import Optional
from fastapi import APIRouter, Depends
from app.database import get_db
from app.security import get_accessible_project_ids, get_current_user, verify_project_access

router = APIRouter(prefix="/api/v1", tags=["audit"])


@router.get("/projects/{project_id}/audit-events")
def list_project_audit(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, actor_id, actor_name, project_id, action, metadata_json, created_at
            FROM audit_events
            WHERE project_id = %s
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (project_id,),
        )
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["metadata"] = json.loads(d["metadata_json"]) if d["metadata_json"] else {}
            del d["metadata_json"]
            results.append(d)
        return results
    finally:
        conn.close()


@router.get("/audit-events")
def list_all_audit(
    limit: int = 50,
    action: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        accessible = get_accessible_project_ids(conn, current_user)
        conditions = []
        params = []

        if accessible is not None:
            if len(accessible) == 0:
                return []
            conditions.append("project_id = ANY(%s)")
            params.append(accessible)

        if action:
            conditions.append("action = %s")
            params.append(action)

        where_clause = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        query = (
            "SELECT id, actor_id, actor_name, project_id, action, metadata_json, created_at FROM audit_events"
            + where_clause
            + " ORDER BY created_at DESC LIMIT %s"
        )
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["metadata"] = json.loads(d["metadata_json"]) if d["metadata_json"] else {}
            del d["metadata_json"]
            results.append(d)
        return results
    finally:
        conn.close()
