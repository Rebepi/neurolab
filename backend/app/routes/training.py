import json
import os
import threading
import time
import uuid
import queue
import asyncio
import psutil
from collections import deque
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.database import get_db
from app.trainer import (
    queue_training_job,
    register_listener,
    request_job_cancellation,
    request_job_pause,
    request_job_resume,
    unregister_listener,
)
from app.security import (
    WRITE_PROJECT_ROLES,
    get_accessible_project_ids,
    get_current_user,
    get_system_quotas_dict,
    log_audit_event,
    verify_project_access,
)

router = APIRouter(prefix="/api/v1", tags=["training"])

_CPU_HISTORY = deque(maxlen=24)

ROLE_PRIORITY = {
    "Administrador": 1,
    "Responsable de proyecto": 2,
    "Ingeniero/analista de IA": 3,
}


def _sample_cpu_loop():
    while True:
        val = round(float(psutil.cpu_percent(interval=1.0)), 1)
        _CPU_HISTORY.append({"t": datetime.now().strftime("%H:%M:%S"), "cpu": val})
        time.sleep(4.0)


threading.Thread(target=_sample_cpu_loop, daemon=True).start()


def _dir_size_mb(path: str) -> float:
    total = 0
    if not os.path.exists(path):
        return 0.0
    for root_dir, _, files in os.walk(path):
        for fname in files:
            fp = os.path.join(root_dir, fname)
            if os.path.isfile(fp):
                total += os.path.getsize(fp)
    return round(total / (1024 * 1024), 2)


class Hyperparams(BaseModel):
    epochs: int = 20
    batch_size: int = 32
    optimizer: str = "adam"
    learning_rate: float = 0.001
    loss_function: Optional[str] = None
    random_seed: Optional[int] = None


class CreateJobRequest(BaseModel):
    architecture_id: str
    dataset_id: str
    hyperparams: Hyperparams
    actor_id: Optional[str] = None


class CancelJobRequest(BaseModel):
    reason: Optional[str] = None


class JobNotesRequest(BaseModel):
    notes: str


@router.get("/dashboard/overview")
def get_dashboard_overview(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        cursor = conn.cursor()
        accessible = get_accessible_project_ids(conn, current_user)

        if accessible is None:
            cursor.execute("SELECT COUNT(*) FROM projects")
            total_projects = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM training_jobs")
            total_jobs = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM training_jobs WHERE status IN ('RUNNING', 'PREPARING', 'QUEUED', 'PAUSED')")
            active_jobs = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM model_versions WHERE status = 'APPROVED'")
            approved_models = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM model_versions")
            total_models = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM datasets")
            total_datasets = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM architectures")
            total_architectures = cursor.fetchone()[0]
            cursor.execute("SELECT splits_json FROM datasets")
            splits_rows = cursor.fetchall()
        elif len(accessible) == 0:
            total_projects = 0
            total_jobs = 0
            active_jobs = 0
            approved_models = 0
            total_models = 0
            total_datasets = 0
            total_architectures = 0
            splits_rows = []
        else:
            cursor.execute("SELECT COUNT(*) FROM projects WHERE id = ANY(%s)", (accessible,))
            total_projects = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM training_jobs WHERE project_id = ANY(%s)", (accessible,))
            total_jobs = cursor.fetchone()[0]
            cursor.execute(
                "SELECT COUNT(*) FROM training_jobs WHERE project_id = ANY(%s) AND status IN ('RUNNING', 'PREPARING', 'QUEUED', 'PAUSED')",
                (accessible,),
            )
            active_jobs = cursor.fetchone()[0]
            cursor.execute(
                "SELECT COUNT(*) FROM model_versions WHERE project_id = ANY(%s) AND status = 'APPROVED'",
                (accessible,),
            )
            approved_models = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM model_versions WHERE project_id = ANY(%s)", (accessible,))
            total_models = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM datasets WHERE project_id = ANY(%s)", (accessible,))
            total_datasets = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM architectures WHERE project_id = ANY(%s)", (accessible,))
            total_architectures = cursor.fetchone()[0]
            cursor.execute("SELECT splits_json FROM datasets WHERE project_id = ANY(%s)", (accessible,))
            splits_rows = cursor.fetchall()

        total_rows_corpus = 0
        for r in splits_rows:
            if r[0]:
                try:
                    sp = json.loads(r[0])
                    total_rows_corpus += int(sp.get("train_count", 0)) + int(sp.get("val_count", 0)) + int(sp.get("test_count", 0))
                except Exception:
                    pass

        if accessible is None:
            cursor.execute(
                """
                SELECT mv.id, mv.project_id, mv.version, mv.status, mv.test_metrics_json, mv.created_at,
                       p.name as project_name, a.name as arch_name, d.name as dataset_name, d.target as target_column
                FROM model_versions mv
                JOIN projects p ON mv.project_id = p.id
                LEFT JOIN training_jobs tj ON mv.job_id = tj.id
                LEFT JOIN architectures a ON tj.architecture_id = a.id
                LEFT JOIN datasets d ON tj.dataset_id = d.id
                ORDER BY mv.created_at DESC
                LIMIT 8
                """
            )
            model_rows = cursor.fetchall()
            cursor.execute(
                """
                SELECT ae.id, ae.actor_name, ae.project_id, ae.action, ae.metadata_json, ae.created_at
                FROM audit_events ae
                ORDER BY ae.created_at DESC
                LIMIT 6
                """
            )
            act_rows = cursor.fetchall()
            cursor.execute(
                """
                SELECT tj.id, tj.project_id, tj.status, tj.progress, tj.current_epoch, tj.total_epochs,
                       tj.loss, tj.accuracy, tj.created_at, tj.started_at, tj.ended_at,
                       p.name as project_name, a.name as arch_name
                FROM training_jobs tj
                JOIN projects p ON tj.project_id = p.id
                JOIN architectures a ON tj.architecture_id = a.id
                ORDER BY tj.created_at DESC
                LIMIT 6
                """
            )
            job_rows = cursor.fetchall()
        elif len(accessible) == 0:
            model_rows = []
            act_rows = []
            job_rows = []
        else:
            cursor.execute(
                """
                SELECT mv.id, mv.project_id, mv.version, mv.status, mv.test_metrics_json, mv.created_at,
                       p.name as project_name, a.name as arch_name, d.name as dataset_name, d.target as target_column
                FROM model_versions mv
                JOIN projects p ON mv.project_id = p.id
                LEFT JOIN training_jobs tj ON mv.job_id = tj.id
                LEFT JOIN architectures a ON tj.architecture_id = a.id
                LEFT JOIN datasets d ON tj.dataset_id = d.id
                WHERE mv.project_id = ANY(%s)
                ORDER BY mv.created_at DESC
                LIMIT 8
                """,
                (accessible,),
            )
            model_rows = cursor.fetchall()
            cursor.execute(
                """
                SELECT ae.id, ae.actor_name, ae.project_id, ae.action, ae.metadata_json, ae.created_at
                FROM audit_events ae
                WHERE ae.project_id = ANY(%s)
                ORDER BY ae.created_at DESC
                LIMIT 6
                """,
                (accessible,),
            )
            act_rows = cursor.fetchall()
            cursor.execute(
                """
                SELECT tj.id, tj.project_id, tj.status, tj.progress, tj.current_epoch, tj.total_epochs,
                       tj.loss, tj.accuracy, tj.created_at, tj.started_at, tj.ended_at,
                       p.name as project_name, a.name as arch_name
                FROM training_jobs tj
                JOIN projects p ON tj.project_id = p.id
                JOIN architectures a ON tj.architecture_id = a.id
                WHERE tj.project_id = ANY(%s)
                ORDER BY tj.created_at DESC
                LIMIT 6
                """,
                (accessible,),
            )
            job_rows = cursor.fetchall()

        trained_models = []
        for r in model_rows:
            d = dict(r)
            metrics = json.loads(d["test_metrics_json"]) if d["test_metrics_json"] else {}
            del d["test_metrics_json"]
            d["test_metrics"] = metrics
            trained_models.append(d)

        recent_activity = []
        for r in act_rows:
            d = dict(r)
            d["metadata"] = json.loads(d["metadata_json"]) if d["metadata_json"] else {}
            del d["metadata_json"]
            recent_activity.append(d)

        recent_jobs = [dict(r) for r in job_rows]
    finally:
        conn.close()

    cpu_pct = round(float(psutil.cpu_percent(interval=0.05)), 1)
    if len(_CPU_HISTORY) == 0:
        _CPU_HISTORY.append({"t": datetime.now().strftime("%H:%M:%S"), "cpu": cpu_pct})
    cpu_hist_list = list(_CPU_HISTORY)
    cpu_avg_pct = round(sum(item["cpu"] for item in cpu_hist_list) / len(cpu_hist_list), 1)
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage(os.path.abspath(os.sep))
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ds_mb = _dir_size_mb(os.path.join(backend_root, "data", "datasets"))
    mdl_mb = _dir_size_mb(os.path.join(backend_root, "data", "models"))

    return {
        "total_projects": total_projects,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "approved_models": approved_models,
        "total_models": total_models,
        "total_datasets": total_datasets,
        "total_architectures": total_architectures,
        "total_rows_corpus": total_rows_corpus,
        "system_health": {
            "status": "OPERATIONAL",
            "uptime_pct": 99.98,
            "engine": "TensorFlow 2.21 / Keras 3",
            "gpu_acceleration": True,
            "queue_capacity": 10,
        },
        "compute_telemetry": {
            "cpu_pct": cpu_pct,
            "cpu_avg_pct": cpu_avg_pct,
            "cpu_cores": os.cpu_count() or 1,
            "ram_used_gb": round(vm.used / (1024 ** 3), 2),
            "ram_total_gb": round(vm.total / (1024 ** 3), 2),
            "ram_pct": round(float(vm.percent), 1),
            "disk_used_gb": round(disk.used / (1024 ** 3), 1),
            "disk_total_gb": round(disk.total / (1024 ** 3), 1),
            "disk_pct": round(float(disk.percent), 1),
            "datasets_storage_mb": ds_mb,
            "models_storage_mb": mdl_mb,
            "runtime_device": "CPU AVX2 / oneDNN",
            "cpu_history": cpu_hist_list,
        },
        "trained_models": trained_models,
        "recent_activity": recent_activity,
        "recent_jobs": recent_jobs,
    }


@router.get("/projects/{project_id}/training-jobs")
def list_project_jobs(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT tj.*, a.name as arch_name, a.family as arch_family, d.name as dataset_name
            FROM training_jobs tj
            JOIN architectures a ON tj.architecture_id = a.id
            JOIN datasets d ON tj.dataset_id = d.id
            WHERE tj.project_id = %s
            ORDER BY tj.created_at DESC
            """,
            (project_id,),
        )
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["hyperparams"] = json.loads(d["hyperparams_json"])
            d["logs"] = json.loads(d["logs_json"]) if d["logs_json"] else []
            del d["hyperparams_json"]
            del d["logs_json"]
            results.append(d)
        return results
    finally:
        conn.close()


@router.post("/projects/{project_id}/training-jobs")
def create_training_job(
    project_id: str,
    req: CreateJobRequest,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        effective_role = verify_project_access(conn, project_id, current_user, allowed_roles=WRITE_PROJECT_ROLES)
        quotas = get_system_quotas_dict(conn)
        max_epochs = int(quotas.get("max_epochs_per_job", 100))
        max_batch = int(quotas.get("max_batch_size", 128))
        max_concurrent = int(quotas.get("max_concurrent_jobs", 4))

        if req.hyperparams.epochs < 1 or req.hyperparams.epochs > max_epochs:
            raise HTTPException(
                status_code=400,
                detail=f"Cuota excedida: las épocas deben estar entre 1 y {max_epochs}.",
            )
        if req.hyperparams.batch_size < 1 or req.hyperparams.batch_size > max_batch:
            raise HTTPException(
                status_code=400,
                detail=f"Cuota excedida: batch_size máximo permitido es {max_batch}.",
            )

        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM training_jobs WHERE status IN ('QUEUED', 'PREPARING', 'RUNNING', 'PAUSED')"
        )
        active_total = cursor.fetchone()[0]
        if active_total >= max_concurrent * 3:
            raise HTTPException(
                status_code=429,
                detail=f"Cola saturada ({active_total} trabajos pendientes/activos). Espera a que finalice alguno.",
            )

        cursor.execute(
            "SELECT id, config_json FROM architectures WHERE id = %s AND project_id = %s",
            (req.architecture_id, project_id),
        )
        arch = cursor.fetchone()
        if not arch:
            raise HTTPException(status_code=404, detail="Arquitectura no encontrada o no pertenece a este proyecto")

        arch_config = json.loads(arch["config_json"])
        arch_input_shape = arch_config.get("input_shape", 0)

        cursor.execute(
            "SELECT id, input_shape FROM datasets WHERE id = %s AND project_id = %s",
            (req.dataset_id, project_id),
        )
        dataset = cursor.fetchone()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset no encontrado o no pertenece a este proyecto")

        if arch_input_shape != dataset["input_shape"]:
            raise HTTPException(
                status_code=400,
                detail=f"Incompatibilidad dimensional: la arquitectura espera input_shape={arch_input_shape}, pero el dataset tiene {dataset['input_shape']} características.",
            )

        job_id = f"job-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        seed_val = int(
            req.hyperparams.random_seed
            if req.hyperparams.random_seed is not None
            else quotas.get("random_seed", 42)
        )
        priority = ROLE_PRIORITY.get(effective_role, ROLE_PRIORITY.get(current_user["role"], 4))
        hp_dump = req.hyperparams.model_dump()
        hp_dump["random_seed"] = seed_val
        hp_json = json.dumps(hp_dump)

        cursor.execute(
            """
            INSERT INTO training_jobs
            (id, project_id, architecture_id, dataset_id, status, progress, current_epoch, total_epochs, hyperparams_json, logs_json, random_seed, priority, created_at)
            VALUES (%s, %s, %s, %s, 'QUEUED', 0.0, 0, %s, %s, '[]', %s, %s, %s)
            """,
            (
                job_id,
                project_id,
                req.architecture_id,
                req.dataset_id,
                req.hyperparams.epochs,
                hp_json,
                seed_val,
                priority,
                now,
            ),
        )

        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            project_id,
            "TRAINING_QUEUED",
            {
                "job_id": job_id,
                "epochs": req.hyperparams.epochs,
                "optimizer": req.hyperparams.optimizer,
                "random_seed": seed_val,
                "priority": priority,
            },
        )
        conn.commit()
    finally:
        conn.close()

    queue_training_job(job_id, priority=priority)

    return {
        "job_id": job_id,
        "project_id": project_id,
        "status": "QUEUED",
        "priority": priority,
        "random_seed": seed_val,
        "created_at": now,
    }


@router.get("/training-jobs/{job_id}")
def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT tj.*, a.name as arch_name, a.family as arch_family, a.config_json,
                   d.name as dataset_name, d.input_shape, d.target
            FROM training_jobs tj
            JOIN architectures a ON tj.architecture_id = a.id
            JOIN datasets d ON tj.dataset_id = d.id
            WHERE tj.id = %s
            """,
            (job_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trabajo de entrenamiento no encontrado")

        verify_project_access(conn, row["project_id"], current_user)

        d = dict(row)
        d["hyperparams"] = json.loads(d["hyperparams_json"])
        d["logs"] = json.loads(d["logs_json"]) if d["logs_json"] else []
        d["architecture_config"] = json.loads(d["config_json"])
        del d["hyperparams_json"]
        del d["logs_json"]
        del d["config_json"]

        cursor.execute("SELECT * FROM model_versions WHERE job_id = %s", (job_id,))
        mv_row = cursor.fetchone()
        if mv_row:
            mv = dict(mv_row)
            mv["test_metrics"] = json.loads(mv["test_metrics_json"])
            mv["confusion_matrix"] = json.loads(mv["confusion_matrix_json"])
            del mv["test_metrics_json"]
            del mv["confusion_matrix_json"]
            d["model_version"] = mv
        else:
            d["model_version"] = None

        return d
    finally:
        conn.close()


@router.get("/training-jobs/{job_id}/metrics")
def get_job_metrics(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT project_id FROM training_jobs WHERE id = %s", (job_id,))
        job_row = cursor.fetchone()
        if not job_row:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado")
        verify_project_access(conn, job_row["project_id"], current_user)

        cursor.execute(
            """
            SELECT epoch, loss, accuracy, val_loss, val_accuracy, recorded_at
            FROM training_metrics
            WHERE job_id = %s
            ORDER BY epoch ASC
            """,
            (job_id,),
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/training-jobs/{job_id}/cancel")
def cancel_job(
    job_id: str,
    req: Optional[CancelJobRequest] = None,
    actor_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT status, project_id FROM training_jobs WHERE id = %s", (job_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado")

        verify_project_access(conn, row["project_id"], current_user, allowed_roles=WRITE_PROJECT_ROLES)

        current_status = row["status"]
        project_id = row["project_id"]

        if current_status in ["COMPLETED", "FAILED", "CANCELLED"]:
            return {"status": current_status, "message": "El trabajo ya no se encuentra en ejecución"}

        reason = (req.reason.strip() if req and req.reason else "") or "Cancelación solicitada por el usuario"
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            project_id,
            "TRAINING_CANCEL_REQUESTED",
            {"job_id": job_id, "reason": reason},
        )
        conn.commit()
    finally:
        conn.close()

    request_job_cancellation(job_id, reason=reason)
    return {"status": "CANCELLATION_REQUESTED", "job_id": job_id, "reason": reason}


@router.post("/training-jobs/{job_id}/pause")
def pause_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT status, project_id FROM training_jobs WHERE id = %s", (job_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado")
        verify_project_access(conn, row["project_id"], current_user, allowed_roles=WRITE_PROJECT_ROLES)
        if row["status"] not in ("RUNNING", "PREPARING"):
            raise HTTPException(status_code=400, detail="Solo se pueden pausar trabajos en ejecución")
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "TRAINING_PAUSED",
            {"job_id": job_id},
        )
        conn.commit()
    finally:
        conn.close()

    request_job_pause(job_id)
    return {"status": "PAUSE_REQUESTED", "job_id": job_id}


@router.post("/training-jobs/{job_id}/resume")
def resume_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT status, project_id FROM training_jobs WHERE id = %s", (job_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado")
        verify_project_access(conn, row["project_id"], current_user, allowed_roles=WRITE_PROJECT_ROLES)
        if row["status"] != "PAUSED":
            raise HTTPException(status_code=400, detail="Solo se pueden reanudar trabajos en estado PAUSED")
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "TRAINING_RESUMED",
            {"job_id": job_id},
        )
        conn.commit()
    finally:
        conn.close()

    request_job_resume(job_id)
    return {"status": "RUNNING", "job_id": job_id}


@router.put("/training-jobs/{job_id}/notes")
def update_job_notes(
    job_id: str,
    req: JobNotesRequest,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, project_id FROM training_jobs WHERE id = %s", (job_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado")
        verify_project_access(
            conn,
            row["project_id"],
            current_user,
            allowed_roles=["Administrador", "Responsable de proyecto", "Ingeniero/analista de IA", "Revisor"],
        )
        cursor.execute("UPDATE training_jobs SET notes = %s WHERE id = %s", (req.notes, job_id))
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "EVALUATION_NOTES_UPDATED",
            {"job_id": job_id, "notes_length": len(req.notes)},
        )
        conn.commit()
    finally:
        conn.close()
    return {"job_id": job_id, "notes": req.notes}


@router.post("/training-jobs/{job_id}/retry")
def retry_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM training_jobs WHERE id = %s", (job_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado")

        effective_role = verify_project_access(conn, row["project_id"], current_user, allowed_roles=WRITE_PROJECT_ROLES)
        priority = ROLE_PRIORITY.get(effective_role, ROLE_PRIORITY.get(current_user["role"], 4))
        quotas = get_system_quotas_dict(conn)
        seed_val = int(row["random_seed"] if row["random_seed"] is not None else quotas.get("random_seed", 42))

        new_job_id = f"job-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

        cursor.execute(
            """
            INSERT INTO training_jobs
            (id, project_id, architecture_id, dataset_id, status, progress, current_epoch, total_epochs, hyperparams_json, logs_json, random_seed, priority, created_at)
            VALUES (%s, %s, %s, %s, 'QUEUED', 0.0, 0, %s, %s, '[]', %s, %s, %s)
            """,
            (
                new_job_id,
                row["project_id"],
                row["architecture_id"],
                row["dataset_id"],
                row["total_epochs"],
                row["hyperparams_json"],
                seed_val,
                priority,
                now,
            ),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "TRAINING_QUEUED",
            {"job_id": new_job_id, "retried_from": job_id},
        )
        conn.commit()
    finally:
        conn.close()

    queue_training_job(new_job_id, priority=priority)
    return {"job_id": new_job_id, "status": "QUEUED"}


@router.get("/training-jobs/{job_id}/events")
async def stream_job_events(
    job_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT project_id FROM training_jobs WHERE id = %s", (job_id,))
        job_row = cursor.fetchone()
        if not job_row:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado")
        verify_project_access(conn, job_row["project_id"], current_user)
    finally:
        conn.close()

    q = register_listener(job_id)

    async def event_generator():
        try:
            conn_init = get_db()
            try:
                cur_init = conn_init.cursor()
                cur_init.execute(
                    "SELECT status, progress, current_epoch, total_epochs, loss, accuracy, val_loss, val_accuracy FROM training_jobs WHERE id = %s",
                    (job_id,),
                )
                initial_row = cur_init.fetchone()
            finally:
                conn_init.close()

            if initial_row:
                yield f"data: {json.dumps(dict(initial_row))}\n\n"

            while True:
                if await request.is_disconnected():
                    break

                try:
                    event = await asyncio.to_thread(q.get, timeout=1.5)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("type") in ["completed", "failed", "cancelled"]:
                        break
                except queue.Empty:
                    yield ": ping\n\n"
        finally:
            unregister_listener(job_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
