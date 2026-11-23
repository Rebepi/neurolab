import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.database import get_db
from app.security import (
    WRITE_PROJECT_ROLES,
    get_current_user,
    log_audit_event,
    verify_project_access,
)

router = APIRouter(prefix="/api/v1", tags=["architectures"])

ALLOWED_LAYERS_BY_FAMILY = {
    "Feedforward": {"dense", "dropout", "batchnormalization"},
    "CNN": {"conv1d", "maxpooling1d", "flatten", "dense", "dropout", "batchnormalization"},
    "RNN": {"lstm", "gru", "dense", "dropout", "batchnormalization"},
    "GAN": {"dense", "dropout", "batchnormalization"},
}


class LayerConfig(BaseModel):
    id: Optional[str] = None
    type: str
    units: Optional[int] = 32
    activation: Optional[str] = "relu"
    rate: Optional[float] = 0.2
    use_bias: Optional[bool] = True
    filters: Optional[int] = 32
    kernel_size: Optional[int] = 3
    padding: Optional[str] = "same"
    pool_size: Optional[int] = 2
    return_sequences: Optional[bool] = False


class ArchitectureCreate(BaseModel):
    name: str
    family: str
    justification: Optional[str] = ""
    input_shape: int
    output_dim: int
    output_activation: str
    layers: List[LayerConfig]
    actor_id: Optional[str] = None


def compute_parameters(
    input_shape: int,
    layers_list: List[LayerConfig],
    output_dim: int,
    family: str = "Feedforward",
) -> int:
    is_seq = family in ("CNN", "RNN")
    seq_len = input_shape
    channels = 1
    current_dim = input_shape
    total_params = 0

    for idx, l in enumerate(layers_list):
        l_type = l.type.lower()
        if l_type == "conv1d":
            filters = int(l.filters or l.units or 32)
            kernel = max(1, min(int(l.kernel_size or 3), seq_len))
            use_bias = l.use_bias if l.use_bias is not None else True
            total_params += (kernel * channels + (1 if use_bias else 0)) * filters
            channels = filters
            if (l.padding or "same").lower() == "valid":
                seq_len = max(1, seq_len - kernel + 1)
            is_seq = True
            current_dim = seq_len * channels
        elif l_type == "maxpooling1d":
            pool = max(1, int(l.pool_size or 2))
            seq_len = max(1, seq_len // pool)
            current_dim = seq_len * channels
        elif l_type == "flatten":
            current_dim = seq_len * channels
            is_seq = False
        elif l_type in ("lstm", "gru"):
            units = int(l.units or 32)
            gates = 4 if l_type == "lstm" else 3
            total_params += gates * ((channels + units) * units + units)
            has_next_rnn = any(
                nxt.type.lower() in ("lstm", "gru") for nxt in layers_list[idx + 1 :]
            )
            if has_next_rnn:
                channels = units
                is_seq = True
                current_dim = seq_len * channels
            else:
                is_seq = False
                current_dim = units
        elif l_type == "dense":
            if is_seq:
                current_dim = seq_len * channels
                is_seq = False
            units = int(l.units or 32)
            use_bias = l.use_bias if l.use_bias is not None else True
            weights = current_dim * units
            biases = units if use_bias else 0
            total_params += weights + biases
            current_dim = units
        elif l_type == "batchnormalization":
            dim_ref = channels if is_seq else current_dim
            total_params += 4 * dim_ref
        elif l_type == "dropout":
            pass

    if is_seq:
        current_dim = seq_len * channels
    total_params += current_dim * output_dim + output_dim
    return total_params


@router.get("/projects/{project_id}/architectures")
def list_architectures(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, project_id, name, family, config_json, version, justification, total_parameters, created_at
            FROM architectures
            WHERE project_id = %s
            ORDER BY created_at DESC
            """,
            (project_id,),
        )
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["config"] = json.loads(d["config_json"])
            del d["config_json"]
            results.append(d)
        return results
    finally:
        conn.close()


@router.post("/projects/{project_id}/architectures")
def create_architecture(
    project_id: str,
    req: ArchitectureCreate,
    current_user: dict = Depends(get_current_user),
):
    if req.input_shape <= 0:
        raise HTTPException(status_code=400, detail="El input_shape debe ser mayor a 0.")
    if req.output_dim <= 0:
        raise HTTPException(status_code=400, detail="El output_dim debe ser mayor a 0.")
    if not req.layers:
        raise HTTPException(status_code=400, detail="La red debe incluir al menos una capa oculta.")

    valid_families = ["Feedforward", "RNN", "CNN", "GAN"]
    if req.family not in valid_families:
        raise HTTPException(status_code=400, detail=f"Familia no válida. Debe ser una de: {', '.join(valid_families)}")

    allowed_types = ALLOWED_LAYERS_BY_FAMILY[req.family]
    for idx, layer in enumerate(req.layers):
        l_type = layer.type.lower()
        if l_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"La capa #{idx + 1} ({layer.type}) no es compatible con la familia {req.family}.",
            )

    total_params = compute_parameters(req.input_shape, req.layers, req.output_dim, req.family)

    config_payload = {
        "family": req.family,
        "input_shape": req.input_shape,
        "output_dim": req.output_dim,
        "output_activation": req.output_activation,
        "layers": [l.model_dump() for l in req.layers],
    }

    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user, allowed_roles=WRITE_PROJECT_ROLES)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM architectures WHERE project_id = %s", (project_id,))
        ver_count = cursor.fetchone()[0] + 1
        version_tag = f"1.{ver_count}.0"

        arch_id = f"arch-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

        cursor.execute(
            """
            INSERT INTO architectures
            (id, project_id, name, family, config_json, version, justification, total_parameters, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                arch_id,
                project_id,
                req.name,
                req.family,
                json.dumps(config_payload),
                version_tag,
                req.justification,
                total_params,
                now,
            ),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            project_id,
            "ARCHITECTURE_CREATED",
            {"arch_id": arch_id, "name": req.name, "family": req.family, "total_params": total_params},
        )
        conn.commit()
    finally:
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
        "created_at": now,
    }


@router.get("/architectures/{arch_id}")
def get_architecture(
    arch_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, project_id, name, family, config_json, version, justification, total_parameters, created_at
            FROM architectures WHERE id = %s
            """,
            (arch_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Arquitectura no encontrada")
        verify_project_access(conn, row["project_id"], current_user)
        d = dict(row)
        d["config"] = json.loads(d["config_json"])
        del d["config_json"]
        return d
    finally:
        conn.close()
