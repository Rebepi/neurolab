import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.database import get_db
from app.fusion import fuse_cross_area_datasets
from app.trainer import queue_training_job
from app.security import (
    MANAGE_PROJECT_ROLES,
    WRITE_PROJECT_ROLES,
    get_current_user,
    get_system_quotas_dict,
    log_audit_event,
    require_roles,
    verify_project_access,
)

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


class AreaSelection(BaseModel):
    project_id: str
    dataset_id: Optional[str] = None


class CrossAreaFusionRequest(BaseModel):
    areas: List[AreaSelection]
    name: Optional[str] = None
    max_rows_per_area: Optional[int] = 4500
    auto_train: Optional[bool] = True
    epochs: Optional[int] = 14
    actor_id: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    description: str
    owner_id: Optional[str] = None
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
def list_projects(
    q: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
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
        if current_user["role"] != "Administrador":
            query += """
                AND (
                    p.owner_id = %s
                    OR EXISTS (
                        SELECT 1 FROM project_members pm
                        WHERE pm.project_id = p.id AND pm.user_id = %s
                    )
                )
            """
            params.extend([current_user["id"], current_user["id"]])
        if q:
            query += " AND (p.name ILIKE %s OR p.description ILIKE %s)"
            params.extend([f"%{q}%", f"%{q}%"])
        if status:
            query += " AND p.status = %s"
            params.append(status)

        query += " ORDER BY p.updated_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"]) if d["tags"] else []
            results.append(d)
        return results
    finally:
        conn.close()


@router.post("")
def create_project(
    req: ProjectCreate,
    current_user: dict = Depends(require_roles("Administrador", "Responsable de proyecto")),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        project_id = f"prj-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        tags_json = json.dumps(req.tags or [])

        owner_id = req.owner_id if (current_user["role"] == "Administrador" and req.owner_id) else current_user["id"]
        cursor.execute("SELECT id, display_name FROM users WHERE id = %s", (owner_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario propietario no encontrado")

        cursor.execute(
            "INSERT INTO projects (id, name, description, owner_id, status, tags, created_at, updated_at) VALUES (%s, %s, %s, %s, 'ACTIVE', %s, %s, %s)",
            (project_id, req.name, req.description, owner_id, tags_json, now, now),
        )

        mem_id = f"mem-{uuid.uuid4().hex[:8]}"
        cursor.execute(
            "INSERT INTO project_members (id, project_id, user_id, role, created_at) VALUES (%s, %s, %s, 'Responsable de proyecto', %s) ON CONFLICT (project_id, user_id) DO NOTHING",
            (mem_id, project_id, owner_id, now),
        )

        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            project_id,
            "PROJECT_CREATED",
            {"name": req.name, "owner_id": owner_id},
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "id": project_id,
        "name": req.name,
        "description": req.description,
        "owner_id": owner_id,
        "status": "ACTIVE",
        "tags": req.tags or [],
        "created_at": now,
        "updated_at": now,
    }


@router.post("/fuse-areas")
def fuse_cross_areas_into_general_model(
    req: CrossAreaFusionRequest,
    current_user: dict = Depends(require_roles("Administrador", "Responsable de proyecto", "Ingeniero/analista de IA")),
):
    if len(req.areas) < 2:
        raise HTTPException(status_code=400, detail="Selecciona al menos 2 áreas para construir el Modelo General Corporativo.")

    conn = get_db()
    try:
        cursor = conn.cursor()
        bundles = []

        for sel in req.areas:
            verify_project_access(conn, sel.project_id, current_user)
            cursor.execute("SELECT id, name FROM projects WHERE id = %s", (sel.project_id,))
            proj_row = cursor.fetchone()
            if not proj_row:
                raise HTTPException(status_code=404, detail=f"Área no encontrada: {sel.project_id}")

            if sel.dataset_id:
                cursor.execute(
                    "SELECT id, storage_key, target, metadata_json FROM datasets WHERE id = %s AND project_id = %s",
                    (sel.dataset_id, sel.project_id),
                )
            else:
                cursor.execute(
                    "SELECT id, storage_key, target, metadata_json FROM datasets WHERE project_id = %s ORDER BY created_at DESC LIMIT 1",
                    (sel.project_id,),
                )
            ds_row = cursor.fetchone()
            if not ds_row:
                raise HTTPException(status_code=400, detail=f"El área '{proj_row['name']}' no tiene datasets cargados.")

            pid_low = sel.project_id.lower()
            area_code = (
                "noc"
                if "noc" in pid_low
                else "antifraude"
                if "antifraude" in pid_low
                else "comercial"
                if "comercial" in pid_low
                else "retencion"
                if "retencion" in pid_low
                else sel.project_id.replace("prj-", "")[:10]
            )

            bundles.append({
                "project_id": proj_row["id"],
                "project_name": proj_row["name"],
                "area_code": area_code,
                "storage_key": ds_row["storage_key"],
                "target": ds_row["target"],
                "metadata": json.loads(ds_row["metadata_json"] or "{}"),
            })

        general_pid = "prj-modelo-general"
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        general_name = req.name or "Modelo General Corporativo · Aura Telecom 360°"
        general_desc = (
            f"Red neuronal unificada que consolida {len(bundles)} áreas operativas de Aura Telecom "
            f"({', '.join(b['area_code'].upper() for b in bundles)}) en un espacio latente común para detectar riesgo corporativo global."
        )

        cursor.execute("SELECT id FROM projects WHERE id = %s", (general_pid,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO projects (id, name, description, owner_id, status, tags, created_at, updated_at) VALUES (%s, %s, %s, %s, 'ACTIVE', %s, %s, %s)",
                (
                    general_pid,
                    general_name,
                    general_desc,
                    current_user["id"],
                    json.dumps(["Modelo General", "Multi-Área 360°", "Aura Telecom"]),
                    now,
                    now,
                ),
            )
            cursor.execute(
                "INSERT INTO project_members (id, project_id, user_id, role, created_at) VALUES (%s, %s, %s, 'Responsable de proyecto', %s) ON CONFLICT (project_id, user_id) DO NOTHING",
                (f"mem-gen-{uuid.uuid4().hex[:6]}", general_pid, current_user["id"], now),
            )
        else:
            cursor.execute(
                "UPDATE projects SET name = %s, description = %s, updated_at = %s WHERE id = %s",
                (general_name, general_desc, now, general_pid),
            )
            cursor.execute(
                "INSERT INTO project_members (id, project_id, user_id, role, created_at) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (project_id, user_id) DO NOTHING",
                (f"mem-gen-{uuid.uuid4().hex[:6]}", general_pid, current_user["id"], current_user["role"], now),
            )

        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "datasets")
        os.makedirs(data_dir, exist_ok=True)
        fused_ds_id = f"ds-general-{uuid.uuid4().hex[:8]}"
        dest_csv = os.path.join(data_dir, f"{fused_ds_id}.csv")

        try:
            eda_result, _, fusion_report = fuse_cross_area_datasets(
                bundles,
                dest_csv,
                max_rows_per_area=int(req.max_rows_per_area or 4500),
                scaler_type="standard",
            )
        except Exception as exc:
            if os.path.exists(dest_csv):
                os.remove(dest_csv)
            raise HTTPException(status_code=400, detail=str(exc))

        cursor.execute("SELECT COUNT(*) FROM datasets WHERE project_id = %s", (general_pid,))
        ds_ver_num = cursor.fetchone()[0] + 1
        ds_name = f"Corpus Unificado Multi-Área ({len(bundles)} Áreas · {eda_result['total_rows']:,} filas)"

        cursor.execute(
            """
            INSERT INTO datasets
            (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                fused_ds_id,
                general_pid,
                ds_name,
                f"1.{ds_ver_num}.0",
                dest_csv,
                json.dumps(eda_result),
                eda_result["input_shape"],
                eda_result["target_column"],
                json.dumps(eda_result["splits"]),
                now,
            ),
        )

        arch_id = f"arch-gen-{uuid.uuid4().hex[:8]}"
        layers_cfg = [
            {"id": "lg-1", "type": "Dense", "units": 128, "activation": "relu", "use_bias": True},
            {"id": "lg-2", "type": "BatchNormalization"},
            {"id": "lg-3", "type": "Dropout", "rate": 0.25},
            {"id": "lg-4", "type": "Dense", "units": 64, "activation": "relu", "use_bias": True},
            {"id": "lg-5", "type": "Dropout", "rate": 0.15},
            {"id": "lg-6", "type": "Dense", "units": 32, "activation": "relu", "use_bias": True},
        ]
        arch_cfg = {
            "family": "Feedforward",
            "input_shape": eda_result["input_shape"],
            "output_dim": eda_result["output_dim"],
            "output_activation": eda_result["output_activation"],
            "layers": layers_cfg,
        }
        curr_d = eda_result["input_shape"]
        tot_p = 0
        for layer in layers_cfg:
            if layer["type"] == "Dense":
                u = layer["units"]
                tot_p += curr_d * u + u
                curr_d = u
            elif layer["type"] == "BatchNormalization":
                tot_p += 4 * curr_d
        tot_p += curr_d * eda_result["output_dim"] + eda_result["output_dim"]

        cursor.execute(
            """
            INSERT INTO architectures
            (id, project_id, name, family, config_json, version, justification, total_parameters, created_at)
            VALUES (%s, %s, %s, 'Feedforward', %s, %s, %s, %s, %s)
            """,
            (
                arch_id,
                general_pid,
                "MLP Corporativo Multi-Área 360° (128→64→32)",
                json.dumps(arch_cfg),
                f"1.{ds_ver_num}.0",
                "Red neuronal profunda con normalización por lotes y regularización dropout entrenada sobre el corpus unificado de múltiples áreas de Aura Telecom.",
                tot_p,
                now,
            ),
        )

        quotas = get_system_quotas_dict(conn)
        job_id = None
        if req.auto_train:
            job_id = f"job-{uuid.uuid4().hex[:8]}"
            max_ep = int(quotas.get("max_epochs_per_job", 100))
            epochs_val = max(5, min(max_ep, int(req.epochs or 14)))
            seed_val = int(quotas.get("random_seed", 42))
            hp = {"epochs": epochs_val, "batch_size": min(64, int(quotas.get("max_batch_size", 128))), "optimizer": "adam", "learning_rate": 0.002}
            cursor.execute(
                """
                INSERT INTO training_jobs
                (id, project_id, architecture_id, dataset_id, status, progress, current_epoch, total_epochs, hyperparams_json, logs_json, random_seed, priority, created_at)
                VALUES (%s, %s, %s, %s, 'QUEUED', 0.0, 0, %s, %s, '[]', %s, 2, %s)
                """,
                (job_id, general_pid, arch_id, fused_ds_id, epochs_val, json.dumps(hp), seed_val, now),
            )

        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            general_pid,
            "CROSS_AREA_MODEL_FUSED",
            fusion_report,
        )
        conn.commit()
    finally:
        conn.close()

    if job_id:
        queue_training_job(job_id, priority=2)

    return {
        "project": {"id": general_pid, "name": general_name},
        "dataset_id": fused_ds_id,
        "dataset_name": ds_name,
        "architecture_id": arch_id,
        "job_id": job_id,
        "fusion_report": fusion_report,
    }


@router.get("/{project_id}")
def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT p.*, u.display_name as owner_name, u.email as owner_email
            FROM projects p
            JOIN users u ON p.owner_id = u.id
            WHERE p.id = %s
            """,
            (project_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        proj = dict(row)
        proj["tags"] = json.loads(proj["tags"]) if proj["tags"] else []

        cursor.execute(
            """
            SELECT pm.id, pm.role, pm.created_at, u.id as user_id, u.display_name, u.email
            FROM project_members pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = %s
            """,
            (project_id,),
        )
        proj["members"] = [dict(m) for m in cursor.fetchall()]

        cursor.execute("SELECT COUNT(*) FROM datasets WHERE project_id = %s", (project_id,))
        proj["datasets_count"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM architectures WHERE project_id = %s", (project_id,))
        proj["architectures_count"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM training_jobs WHERE project_id = %s", (project_id,))
        proj["jobs_count"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM model_versions WHERE project_id = %s", (project_id,))
        proj["models_count"] = cursor.fetchone()[0]

        return proj
    finally:
        conn.close()


@router.put("/{project_id}")
def update_project(
    project_id: str,
    req: ProjectUpdate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user, allowed_roles=MANAGE_PROJECT_ROLES)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        name = req.name if req.name is not None else row["name"]
        desc = req.description if req.description is not None else row["description"]
        stat = req.status if req.status is not None else row["status"]
        tags_json = json.dumps(req.tags) if req.tags is not None else row["tags"]

        cursor.execute(
            "UPDATE projects SET name = %s, description = %s, status = %s, tags = %s, updated_at = %s WHERE id = %s",
            (name, desc, stat, tags_json, now, project_id),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            project_id,
            "PROJECT_UPDATED",
            {"name": name, "status": stat},
        )
        conn.commit()
        return {"id": project_id, "name": name, "description": desc, "status": stat, "updated_at": now}
    finally:
        conn.close()


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user, allowed_roles=MANAGE_PROJECT_ROLES)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM projects WHERE id = %s", (project_id,))
        conn.commit()
        return {"status": "deleted", "id": project_id}
    finally:
        conn.close()


@router.post("/{project_id}/members")
def add_member(
    project_id: str,
    req: MemberAdd,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user, allowed_roles=MANAGE_PROJECT_ROLES)
        cursor = conn.cursor()
        cursor.execute("SELECT id, display_name FROM users WHERE id = %s", (req.user_id,))
        target_user = cursor.fetchone()
        if not target_user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        mem_id = f"mem-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        try:
            cursor.execute(
                "INSERT INTO project_members (id, project_id, user_id, role, created_at) VALUES (%s, %s, %s, %s, %s)",
                (mem_id, project_id, req.user_id, req.role, now),
            )
            log_audit_event(
                conn,
                current_user["id"],
                current_user["display_name"],
                project_id,
                "MEMBER_ADDED",
                {"user_id": req.user_id, "display_name": target_user["display_name"], "role": req.role},
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise HTTPException(status_code=400, detail="El usuario ya es miembro de este proyecto")

        return {"id": mem_id, "project_id": project_id, "user_id": req.user_id, "role": req.role}
    finally:
        conn.close()


@router.delete("/{project_id}/members/{user_id}")
def remove_member(
    project_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user, allowed_roles=MANAGE_PROJECT_ROLES)
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM project_members WHERE project_id = %s AND user_id = %s",
            (project_id, user_id),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            project_id,
            "MEMBER_REMOVED",
            {"user_id": user_id},
        )
        conn.commit()
        return {"status": "removed"}
    finally:
        conn.close()
