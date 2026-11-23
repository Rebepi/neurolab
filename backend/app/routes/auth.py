import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from app.database import get_db, hash_pw, verify_pw
from app.security import (
    create_access_token,
    get_current_user,
    get_system_policies_dict,
    log_audit_event,
    require_roles,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

VALID_ROLES = [
    "Administrador",
    "Responsable de proyecto",
    "Ingeniero/analista de IA",
    "Revisor",
    "Lector",
]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    role: str


@router.post("/login")
def login(req: LoginRequest):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, password_hash, display_name, role, status, created_at FROM users WHERE email = %s",
            (req.email,),
        )
        row = cursor.fetchone()

        if not row or not verify_pw(req.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        if row["status"] != "ACTIVE":
            raise HTTPException(status_code=403, detail="Usuario desactivado")

        policies = get_system_policies_dict(conn)
        timeout_min = int(policies.get("session_timeout_minutes", 480))
        user_payload = {
            "id": row["id"],
            "email": row["email"],
            "display_name": row["display_name"],
            "role": row["role"],
            "status": row["status"],
            "created_at": row["created_at"],
        }
        token = create_access_token(user_payload, timeout_minutes=timeout_min)
        log_audit_event(
            conn,
            row["id"],
            row["display_name"],
            None,
            "USER_LOGIN",
            {"email": row["email"], "role": row["role"]},
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_payload,
    }


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.get("/users")
def list_users(
    current_user: dict = Depends(require_roles("Administrador", "Responsable de proyecto")),
):
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


@router.post("/users")
def create_user(
    req: UserCreate,
    current_user: dict = Depends(require_roles("Administrador")),
):
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Rol especificado no válido")

    conn = get_db()
    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (id, email, password_hash, display_name, role, status, created_at) VALUES (%s, %s, %s, %s, %s, 'ACTIVE', %s)",
            (user_id, req.email, hash_pw(req.password), req.display_name, req.role, now),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            None,
            "USER_CREATED",
            {"user_id": user_id, "email": req.email, "role": req.role},
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=400, detail="El correo ya se encuentra registrado")
    finally:
        conn.close()

    return {
        "id": user_id,
        "email": req.email,
        "display_name": req.display_name,
        "role": req.role,
        "status": "ACTIVE",
        "created_at": now,
    }
