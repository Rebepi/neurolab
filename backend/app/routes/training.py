import json
import uuid
import queue
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.database import get_db
from app.trainer import queue_training_job, request_job_cancellation, register_listener, unregister_listener

router = APIRouter(prefix="/api/v1", tags=["training"])

class Hyperparams(BaseModel):
    epochs: int = 20
    batch_size: int = 32
    optimizer: str = "adam"
    learning_rate: float = 0.001
    loss_function: Optional[str] = None

class CreateJobRequest(BaseModel):
    architecture_id: str
    dataset_id: str
    hyperparams: Hyperparams
    actor_id: Optional[str] = "usr-engineer"

@router.get("/dashboard/overview")
def get_dashboard_overview():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM projects")
    total_projects = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM training_jobs")
    total_jobs = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM training_jobs WHERE status IN ('RUNNING', 'PREPARING', 'QUEUED')")
    active_jobs = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM model_versions WHERE status = 'APPROVED'")
    approved_models = cursor.fetchone()[0]

    cursor.execute("""
        SELECT tj.id, tj.project_id, tj.status, tj.progress, tj.current_epoch, tj.total_epochs,
               tj.loss, tj.accuracy, tj.created_at, tj.started_at, tj.ended_at,
               p.name as project_name, a.name as arch_name
        FROM training_jobs tj
        JOIN projects p ON tj.project_id = p.id
        JOIN architectures a ON tj.architecture_id = a.id
        ORDER BY tj.created_at DESC
        LIMIT 6
    """)
    recent_jobs = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "total_projects": total_projects,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "approved_models": approved_models,
        "system_health": {
            "status": "OPERATIONAL",
            "uptime_pct": 99.98,
            "engine": "TensorFlow/Keras Python 3.11",
            "gpu_acceleration": True,
            "queue_capacity": 10
        },
        "recent_jobs": recent_jobs
    }

@router.get("/projects/{project_id}/training-jobs")
def list_project_jobs(project_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT tj.*, a.name as arch_name, a.family as arch_family, d.name as dataset_name
        FROM training_jobs tj
        JOIN architectures a ON tj.architecture_id = a.id
        JOIN datasets d ON tj.dataset_id = d.id
        WHERE tj.project_id = ?
        ORDER BY tj.created_at DESC
    """, (project_id,))
    rows = cursor.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["hyperparams"] = json.loads(d["hyperparams_json"])
        d["logs"] = json.loads(d["logs_json"]) if d["logs_json"] else []
        del d["hyperparams_json"]
        del d["logs_json"]
        results.append(d)
    conn.close()
    return results

@router.post("/projects/{project_id}/training-jobs")
def create_training_job(project_id: str, req: CreateJobRequest):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    cursor.execute("SELECT id, config_json FROM architectures WHERE id = ? AND project_id = ?", (req.architecture_id, project_id))
    arch = cursor.fetchone()
    if not arch:
        conn.close()
        raise HTTPException(status_code=404, detail="Arquitectura no encontrada o no pertenece a este proyecto")

    arch_config = json.loads(arch["config_json"])
    arch_input_shape = arch_config.get("input_shape", 0)

    cursor.execute("SELECT id, input_shape FROM datasets WHERE id = ? AND project_id = ?", (req.dataset_id, project_id))
    dataset = cursor.fetchone()
    if not dataset:
        conn.close()
        raise HTTPException(status_code=404, detail="Dataset no encontrado o no pertenece a este proyecto")

    if arch_input_shape != dataset["input_shape"]:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Incompatibilidad dimensional: la arquitectura espera input_shape={arch_input_shape}, pero el dataset tiene {dataset['input_shape']} características."
        )

    job_id = f"job-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()
    hp_json = json.dumps(req.hyperparams.model_dump())

    cursor.execute("""
        INSERT INTO training_jobs 
        (id, project_id, architecture_id, dataset_id, status, progress, current_epoch, total_epochs, hyperparams_json, logs_json, created_at)
        VALUES (?, ?, ?, ?, 'QUEUED', 0.0, 0, ?, ?, '[]', ?)
    """, (
        job_id, project_id, req.architecture_id, req.dataset_id,
        req.hyperparams.epochs, hp_json, now
    ))

    audit_id = f"aud-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
        INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at)
        VALUES (?, ?, 'Ingeniero IA', ?, 'TRAINING_QUEUED', ?, ?)
    """, (
        audit_id, req.actor_id, project_id,
        json.dumps({"job_id": job_id, "epochs": req.hyperparams.epochs, "optimizer": req.hyperparams.optimizer}),
        now
    ))

    conn.commit()
    conn.close()

    queue_training_job(job_id)

    return {
        "job_id": job_id,
        "project_id": project_id,
        "status": "QUEUED",
        "created_at": now
    }

@router.get("/training-jobs/{job_id}")
def get_job(job_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT tj.*, a.name as arch_name, a.family as arch_family, a.config_json,
               d.name as dataset_name, d.input_shape, d.target
        FROM training_jobs tj
        JOIN architectures a ON tj.architecture_id = a.id
        JOIN datasets d ON tj.dataset_id = d.id
        WHERE tj.id = ?
    """, (job_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Trabajo de entrenamiento no encontrado")

    d = dict(row)
    d["hyperparams"] = json.loads(d["hyperparams_json"])
    d["logs"] = json.loads(d["logs_json"]) if d["logs_json"] else []
    d["architecture_config"] = json.loads(d["config_json"])
    del d["hyperparams_json"]
    del d["logs_json"]
    del d["config_json"]

    cursor.execute("SELECT * FROM model_versions WHERE job_id = ?", (job_id,))
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

    conn.close()
    return d

@router.get("/training-jobs/{job_id}/metrics")
def get_job_metrics(job_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT epoch, loss, accuracy, val_loss, val_accuracy, recorded_at
        FROM training_metrics
        WHERE job_id = ?
        ORDER BY epoch ASC
    """, (job_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/training-jobs/{job_id}/cancel")
def cancel_job(job_id: str, actor_id: Optional[str] = "usr-engineer"):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT status, project_id FROM training_jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")

    current_status = row["status"]
    project_id = row["project_id"]

    if current_status in ["COMPLETED", "FAILED", "CANCELLED"]:
        conn.close()
        return {"status": current_status, "message": "El trabajo ya no se encuentra en ejecución"}

    request_job_cancellation(job_id)
    now = datetime.utcnow().isoformat()

    audit_id = f"aud-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
        INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at)
        VALUES (?, ?, 'Usuario', ?, 'TRAINING_CANCEL_REQUESTED', ?, ?)
    """, (audit_id, actor_id, project_id, json.dumps({"job_id": job_id}), now))
    conn.commit()
    conn.close()

    return {"status": "CANCELLATION_REQUESTED", "job_id": job_id}

@router.post("/training-jobs/{job_id}/retry")
def retry_job(job_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM training_jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")

    new_job_id = f"job-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()

    cursor.execute("""
        INSERT INTO training_jobs 
        (id, project_id, architecture_id, dataset_id, status, progress, current_epoch, total_epochs, hyperparams_json, logs_json, created_at)
        VALUES (?, ?, ?, ?, 'QUEUED', 0.0, 0, ?, ?, '[]', ?)
    """, (
        new_job_id, row["project_id"], row["architecture_id"], row["dataset_id"],
        row["total_epochs"], row["hyperparams_json"], now
    ))
    conn.commit()
    conn.close()

    queue_training_job(new_job_id)
    return {"job_id": new_job_id, "status": "QUEUED"}

@router.get("/training-jobs/{job_id}/events")
async def stream_job_events(job_id: str, request: Request):
    q = register_listener(job_id)

    async def event_generator():
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT status, progress, current_epoch, total_epochs, loss, accuracy, val_loss, val_accuracy FROM training_jobs WHERE id = ?", (job_id,))
            initial_row = cursor.fetchone()
            conn.close()

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
            "X-Accel-Buffering": "no"
        }
    )

