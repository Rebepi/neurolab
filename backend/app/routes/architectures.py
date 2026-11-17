import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_db

router = APIRouter(prefix="/api/v1", tags=["architectures"])

class LayerConfig(BaseModel):
    id: Optional[str] = None
    type: str
    units: Optional[int] = 32
    activation: Optional[str] = "relu"
    rate: Optional[float] = 0.2
    use_bias: Optional[bool] = True

class ArchitectureCreate(BaseModel):
    name: str
    family: str
    justification: Optional[str] = ""
    input_shape: int
    output_dim: int
    output_activation: str
    layers: List[LayerConfig]
    actor_id: Optional[str] = "usr-admin"

def compute_parameters(input_shape: int, layers_list: List[LayerConfig], output_dim: int) -> int:
    current_dim = input_shape
    total_params = 0

    for l in layers_list:
        l_type = l.type.lower()
        if l_type == "dense":
            units = l.units or 32
            use_bias = l.use_bias if l.use_bias is not None else True
            weights = current_dim * units
            biases = units if use_bias else 0
            total_params += (weights + biases)
            current_dim = units
        elif l_type == "batchnormalization":
            total_params += (4 * current_dim)
        elif l_type == "dropout":
            pass

    out_weights = current_dim * output_dim
    out_biases = output_dim
    total_params += (out_weights + out_biases)
    return total_params

@router.get("/projects/{project_id}/architectures")
def list_architectures(project_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, project_id, name, family, config_json, version, justification, total_parameters, created_at
        FROM architectures
        WHERE project_id = ?
        ORDER BY created_at DESC
    """, (project_id,))
    rows = cursor.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["config"] = json.loads(d["config_json"])
        del d["config_json"]
        results.append(d)
    conn.close()
    return results

@router.post("/projects/{project_id}/architectures")
def create_architecture(project_id: str, req: ArchitectureCreate):
    if req.input_shape <= 0:
        raise HTTPException(status_code=400, detail="El input_shape debe ser mayor a 0.")
    if req.output_dim <= 0:
        raise HTTPException(status_code=400, detail="El output_dim debe ser mayor a 0.")
    if not req.layers:
        raise HTTPException(status_code=400, detail="La red debe incluir al menos una capa oculta.")

    valid_families = ["Feedforward", "RNN", "CNN", "GAN"]
    if req.family not in valid_families:
        raise HTTPException(status_code=400, detail=f"Familia no válida. Debe ser una de: {', '.join(valid_families)}")

    total_params = compute_parameters(req.input_shape, req.layers, req.output_dim)

    config_payload = {
        "family": req.family,
        "input_shape": req.input_shape,
        "output_dim": req.output_dim,
        "output_activation": req.output_activation,
        "layers": [l.model_dump() for l in req.layers]
    }

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM architectures WHERE project_id = ?", (project_id,))
    ver_count = cursor.fetchone()[0] + 1
    version_tag = f"1.{ver_count}.0"

    arch_id = f"arch-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()

    cursor.execute("""
        INSERT INTO architectures 
        (id, project_id, name, family, config_json, version, justification, total_parameters, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        arch_id, project_id, req.name, req.family,
        json.dumps(config_payload), version_tag, req.justification,
        total_params, now
    ))

    audit_id = f"aud-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
        INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at)
        VALUES (?, ?, 'Ingeniero IA', ?, 'ARCHITECTURE_CREATED', ?, ?)
    """, (
        audit_id, req.actor_id, project_id,
        json.dumps({"arch_id": arch_id, "name": req.name, "family": req.family, "total_params": total_params}),
        now
    ))

    conn.commit()
    conn.close()

    return {
        "id": arch_id,
        "project_id": project_id,
        "name": req.name,
        "family": req.family,
        "version": version_tag,
        "total_parameters": total_params,
        "justification": req.justification,
        "config": config_payload,
        "created_at": now
    }

@router.get("/architectures/{arch_id}")
def get_architecture(arch_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, project_id, name, family, config_json, version, justification, total_parameters, created_at
        FROM architectures WHERE id = ?
    """, (arch_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Arquitectura no encontrada")
    d = dict(row)
    d["config"] = json.loads(d["config_json"])
    del d["config_json"]
    return d

