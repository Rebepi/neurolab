import os
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List
import jwt
from fastapi import Depends, HTTPException, Request
from app.database import get_db

DEFAULT_QUOTAS = {
    "max_concurrent_jobs": 4,
    "max_epochs_per_job": 100,
    "max_dataset_mb": 50,
    "gpu_acceleration": True,
    "retention_days": 90,
    "max_batch_size": 128,
    "mixed_precision": False,
    "random_seed": 42,
}

DEFAULT_POLICIES = {
    "dataset_split_ratio": "70/15/15",
    "min_certification_accuracy": 75,
    "auto_approve_models": False,
    "early_stopping_enabled": True,
    "early_stopping_patience": 5,
    "session_timeout_minutes": 480,
    "strict_inference_audit": True,
    "require_sha256_export": True,
}

WRITE_PROJECT_ROLES = ["Administrador", "Responsable de proyecto", "Ingeniero/analista de IA"]
MANAGE_PROJECT_ROLES = ["Administrador", "Responsable de proyecto"]
REVIEW_MODEL_ROLES = ["Administrador", "Responsable de proyecto", "Revisor"]


def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "neurolab-enterprise-jwt-secret-2026-aura-telecom")


def get_system_quotas_dict(conn) -> dict:
    cur = conn.cursor()
    cur.execute("SELECT value FROM system_config WHERE key = 'quotas'")
    row = cur.fetchone()
    if row and row["value"]:
        try:
            return {**DEFAULT_QUOTAS, **json.loads(row["value"])}
        except Exception:
            pass
    return dict(DEFAULT_QUOTAS)


def get_system_policies_dict(conn) -> dict:
    cur = conn.cursor()
    cur.execute("SELECT value FROM system_config WHERE key = 'policies'")
    row = cur.fetchone()
    if row and row["value"]:
        try:
            return {**DEFAULT_POLICIES, **json.loads(row["value"])}
        except Exception:
            pass
    return dict(DEFAULT_POLICIES)


def create_access_token(user: dict, timeout_minutes: int = 480) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=max(15, int(timeout_minutes)))).timestamp()),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])


def extract_bearer_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        tok = auth_header[7:].strip()
        if tok:
            return tok
    q_tok = request.query_params.get("token")
    if q_tok:
        return q_tok.strip()
    return None


def get_current_user(request: Request) -> dict:
    token = extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Autenticación requerida")

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, display_name, role, status, created_at FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    if row["status"] != "ACTIVE":
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    return dict(row)


def require_roles(*roles: str):
    def _checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Permisos insuficientes para esta operación")
        return current_user

    return _checker


def verify_project_access(
    conn,
    project_id: str,
    user: dict,
    allowed_roles: Optional[List[str]] = None,
) -> str:
    cur = conn.cursor()
    cur.execute("SELECT id, owner_id FROM projects WHERE id = %s", (project_id,))
    proj = cur.fetchone()
    if not proj:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if user["role"] == "Administrador":
        return "Administrador"

    cur.execute(
        "SELECT role FROM project_members WHERE project_id = %s AND user_id = %s",
        (project_id, user["id"]),
    )
    mem = cur.fetchone()

    if mem:
        effective_role = mem["role"]
    elif proj["owner_id"] == user["id"]:
        effective_role = user["role"]
    else:
        raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto")

    if allowed_roles is not None and effective_role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Tu rol no tiene permisos para ejecutar esta acción en el proyecto",
        )
    return effective_role


def get_accessible_project_ids(conn, user: dict) -> Optional[List[str]]:
    if user["role"] == "Administrador":
        return None
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT p.id
        FROM projects p
        LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = %s
        WHERE p.owner_id = %s OR pm.user_id IS NOT NULL
        """,
        (user["id"], user["id"]),
    )
    return [r["id"] for r in cur.fetchall()]


def log_audit_event(
    conn,
    actor_id: str,
    actor_name: str,
    project_id: Optional[str],
    action: str,
    metadata: dict,
):
    cur = conn.cursor()
    audit_id = f"aud-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    cur.execute(
        """
        INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (audit_id, actor_id, actor_name, project_id, action, json.dumps(metadata), now),
    )
