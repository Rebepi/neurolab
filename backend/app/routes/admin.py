import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.database import get_db
from app.security import (
    DEFAULT_POLICIES,
    DEFAULT_QUOTAS,
    get_current_user,
    log_audit_event,
    require_roles,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class RoleChangeRequest(BaseModel):
    role: str


class StatusChangeRequest(BaseModel):
    status: str


class QuotasUpdate(BaseModel):
    max_concurrent_jobs: int
    max_epochs_per_job: int
    max_dataset_mb: int
    gpu_acceleration: bool
    retention_days: int
    max_batch_size: int = 128
    mixed_precision: bool = False
    random_seed: int = 42


class PoliciesUpdate(BaseModel):
    dataset_split_ratio: str = "70/15/15"
    min_certification_accuracy: int = 75
    auto_approve_models: bool = False
    early_stopping_enabled: bool = True
    early_stopping_patience: int = 5
    session_timeout_minutes: int = 480
    strict_inference_audit: bool = True
    require_sha256_export: bool = True


@router.get("/users")
def get_all_users(current_user: dict = Depends(require_roles("Administrador"))):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, display_name, role, status, created_at FROM users ORDER BY created_at DESC"
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    req: RoleChangeRequest,
    current_user: dict = Depends(require_roles("Administrador")),
):
    valid_roles = [
        "Administrador",
        "Responsable de proyecto",
        "Ingeniero/analista de IA",
        "Revisor",
        "Lector",
    ]
    if req.role not in valid_roles:
        raise HTTPException(status_code=400, detail="Rol especificado no válido")

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, role FROM users WHERE id = %s", (user_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        cursor.execute("UPDATE users SET role = %s WHERE id = %s", (req.role, user_id))
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            None,
            "USER_ROLE_CHANGED",
            {"target_user_id": user_id, "previous_role": target["role"], "new_role": req.role},
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": user_id, "role": req.role}


@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    req: StatusChangeRequest,
    current_user: dict = Depends(require_roles("Administrador")),
):
    if req.status not in ["ACTIVE", "INACTIVE"]:
        raise HTTPException(status_code=400, detail="Estado no válido. Use 'ACTIVE' o 'INACTIVE'")
    if user_id == current_user["id"] and req.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, status FROM users WHERE id = %s", (user_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        cursor.execute("UPDATE users SET status = %s WHERE id = %s", (req.status, user_id))
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            None,
            "USER_STATUS_CHANGED",
            {"target_user_id": user_id, "previous_status": target["status"], "new_status": req.status},
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": user_id, "status": req.status}


@router.get("/system/quotas")
def get_system_quotas(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_config WHERE key = 'quotas'")
        row = cursor.fetchone()
        if row:
            return {**DEFAULT_QUOTAS, **json.loads(row[0])}
        return dict(DEFAULT_QUOTAS)
    finally:
        conn.close()


@router.put("/system/quotas")
def update_system_quotas(
    req: QuotasUpdate,
    current_user: dict = Depends(require_roles("Administrador")),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        data_json = json.dumps(req.model_dump())
        cursor.execute(
            "INSERT INTO system_config (key, value) VALUES ('quotas', %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (data_json,),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            None,
            "QUOTAS_UPDATED",
            req.model_dump(),
        )
        conn.commit()
    finally:
        conn.close()
    return req.model_dump()


@router.get("/system/policies")
def get_system_policies(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_config WHERE key = 'policies'")
        row = cursor.fetchone()
        if row:
            return {**DEFAULT_POLICIES, **json.loads(row[0])}
        return dict(DEFAULT_POLICIES)
    finally:
        conn.close()


@router.put("/system/policies")
def update_system_policies(
    req: PoliciesUpdate,
    current_user: dict = Depends(require_roles("Administrador")),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        data_json = json.dumps(req.model_dump())
        cursor.execute(
            "INSERT INTO system_config (key, value) VALUES ('policies', %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (data_json,),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            None,
            "POLICIES_UPDATED",
            req.model_dump(),
        )
        conn.commit()
    finally:
        conn.close()
    return req.model_dump()
