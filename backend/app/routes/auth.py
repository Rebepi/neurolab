import json
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from app.database import get_db, hash_pw

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

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
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password_hash, display_name, role, status FROM users WHERE email = ?", (req.email,))
    row = cursor.fetchone()
    conn.close()

    if not row or row["password_hash"] != hash_pw(req.password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if row["status"] != "ACTIVE":
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    token = f"tok-{row['id']}-{uuid.uuid4().hex[:12]}"
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": row["id"],
            "email": row["email"],
            "display_name": row["display_name"],
            "role": row["role"],
            "status": row["status"]
        }
    }

@router.get("/users")
def list_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, display_name, role, status, created_at FROM users ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/users")
def create_user(req: UserCreate):
    conn = get_db()
    cursor = conn.cursor()
    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()
    try:
        cursor.execute(
            "INSERT INTO users (id, email, password_hash, display_name, role, status, created_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)",
            (user_id, req.email, hash_pw(req.password), req.display_name, req.role, now)
        )
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail="El correo ya se encuentra registrado")
    conn.close()
    return {
        "id": user_id,
        "email": req.email,
        "display_name": req.display_name,
        "role": req.role,
        "status": "ACTIVE",
        "created_at": now
    }

