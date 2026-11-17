import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_db

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

class RoleChangeRequest(BaseModel):
    role: str

class StatusChangeRequest(BaseModel):
    status: str

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
def get_all_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, display_name, role, status, created_at FROM users ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.put("/users/{user_id}/role")
def update_user_role(user_id: str, req: RoleChangeRequest):
    valid_roles = [
        "Administrador",
        "Responsable de proyecto",
        "Ingeniero/analista de IA",
        "Revisor",
        "Lector"
    ]
    if req.role not in valid_roles:
        raise HTTPException(status_code=400, detail="Rol especificado no válido")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = ? WHERE id = ?", (req.role, user_id))
    conn.commit()
    conn.close()
    return {"id": user_id, "role": req.role}

@router.put("/users/{user_id}/status")
def update_user_status(user_id: str, req: StatusChangeRequest):
    if req.status not in ["ACTIVE", "INACTIVE"]:
        raise HTTPException(status_code=400, detail="Estado no válido. Use 'ACTIVE' o 'INACTIVE'")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = ? WHERE id = ?", (req.status, user_id))
    conn.commit()
    conn.close()
    return {"id": user_id, "status": req.status}

@router.get("/system/quotas")
def get_system_quotas():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM system_config WHERE key = 'quotas'")
    row = cursor.fetchone()
    conn.close()
    if row:
        return {**DEFAULT_QUOTAS, **json.loads(row[0])}
    return dict(DEFAULT_QUOTAS)

@router.put("/system/quotas")
def update_system_quotas(req: QuotasUpdate):
    conn = get_db()
    cursor = conn.cursor()
    data_json = json.dumps(req.model_dump())
    cursor.execute("INSERT OR REPLACE INTO system_config (key, value) VALUES ('quotas', ?)", (data_json,))
    conn.commit()
    conn.close()
    return req.model_dump()

@router.get("/system/policies")
def get_system_policies():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM system_config WHERE key = 'policies'")
    row = cursor.fetchone()
    conn.close()
    if row:
        return {**DEFAULT_POLICIES, **json.loads(row[0])}
    return dict(DEFAULT_POLICIES)

@router.put("/system/policies")
def update_system_policies(req: PoliciesUpdate):
    conn = get_db()
    cursor = conn.cursor()
    data_json = json.dumps(req.model_dump())
    cursor.execute("INSERT OR REPLACE INTO system_config (key, value) VALUES ('policies', ?)", (data_json,))
    conn.commit()
    conn.close()
    return req.model_dump()

