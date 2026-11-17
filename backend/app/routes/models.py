import os
import json
import uuid
import numpy as np
import tensorflow as tf
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app.database import get_db

router = APIRouter(prefix="/api/v1", tags=["models"])

class StatusUpdateRequest(BaseModel):
    status: str
    actor_id: Optional[str] = "usr-reviewer"
    notes: Optional[str] = None

@router.get("/projects/{project_id}/models")
def list_project_models(project_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT mv.*, tj.architecture_id, tj.dataset_id,
               a.name as arch_name, a.family as arch_family,
               d.name as dataset_name
        FROM model_versions mv
        JOIN training_jobs tj ON mv.job_id = tj.id
        JOIN architectures a ON tj.architecture_id = a.id
        JOIN datasets d ON tj.dataset_id = d.id
        WHERE mv.project_id = ?
        ORDER BY mv.created_at DESC
    """, (project_id,))
    rows = cursor.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["test_metrics"] = json.loads(d["test_metrics_json"])
        d["confusion_matrix"] = json.loads(d["confusion_matrix_json"])
        del d["test_metrics_json"]
        del d["confusion_matrix_json"]
        results.append(d)
    conn.close()
    return results

@router.get("/models/{model_id}")
def get_model(model_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT mv.*, tj.architecture_id, tj.dataset_id,
               a.name as arch_name, a.family as arch_family, a.config_json,
               d.name as dataset_name, d.target
        FROM model_versions mv
        JOIN training_jobs tj ON mv.job_id = tj.id
        JOIN architectures a ON tj.architecture_id = a.id
        JOIN datasets d ON tj.dataset_id = d.id
        WHERE mv.id = ?
    """, (model_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    d = dict(row)
    d["test_metrics"] = json.loads(d["test_metrics_json"])
    d["confusion_matrix"] = json.loads(d["confusion_matrix_json"])
    d["architecture_config"] = json.loads(d["config_json"])
    del d["test_metrics_json"]
    del d["confusion_matrix_json"]
    del d["config_json"]
    return d

@router.put("/models/{model_id}/status")
def update_model_status(model_id: str, req: StatusUpdateRequest):
    valid_statuses = ["Borrador", "En Revisión", "Aprobado", "Retirado", "APPROVED", "IN_REVIEW", "DRAFT", "RETIRED"]
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, project_id, version, status FROM model_versions WHERE id = ?", (model_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE model_versions SET status = ? WHERE id = ?", (req.status, model_id))

    audit_id = f"aud-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
        INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at)
        VALUES (?, ?, 'Revisor', ?, 'MODEL_STATUS_CHANGED', ?, ?)
    """, (
        audit_id, req.actor_id, row["project_id"],
        json.dumps({
            "model_id": model_id,
            "version": row["version"],
            "previous_status": row["status"],
            "new_status": req.status,
            "notes": req.notes
        }),
        now
    ))

    conn.commit()
    conn.close()
    return {"id": model_id, "status": req.status, "updated_at": now}

@router.get("/models/{model_id}/download")
def download_model_binary(model_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT storage_key, version FROM model_versions WHERE id = ?", (model_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    path = row["storage_key"]
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="El archivo binario del modelo no se encuentra en el almacenamiento local")

    filename = f"neurolab_model_{row['version'].replace('.', '_')}.keras"
    return FileResponse(path, filename=filename, media_type="application/octet-stream")

@router.get("/models/{model_id}/download-spec")
def download_model_spec(model_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT storage_key, version FROM model_versions WHERE id = ?", (model_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    spec_path = row["storage_key"].replace(".keras", "_spec.json")
    if not os.path.exists(spec_path):
        raise HTTPException(status_code=404, detail="La especificación JSON del modelo no se encuentra")

    filename = f"neurolab_spec_{row['version'].replace('.', '_')}.json"
    return FileResponse(spec_path, filename=filename, media_type="application/json")

@router.get("/projects/{project_id}/visualizer-state")
def get_project_visualizer_state(project_id: str, max_neurons_per_layer: int = 12):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, name, input_shape, target, metadata_json, storage_key
        FROM datasets
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    """, (project_id,))
    ds_row = cursor.fetchone()

    samples = []
    feature_names = []
    target_name = "target"

    if ds_row:
        target_name = ds_row["target"] or "target"
        try:
            eda = json.loads(ds_row["metadata_json"] or "{}")
            cols = [c["name"] for c in eda.get("columns", []) if c["name"] != target_name]
            feature_names = cols
        except Exception:
            feature_names = []

        raw_key = ds_row["storage_key"] or ""
        npz_path = raw_key.replace(".csv", "_splits.npz") if raw_key.endswith(".csv") else raw_key
        if npz_path and os.path.exists(npz_path):
            try:
                data = np.load(npz_path)
                X_arr = data["X_test"] if "X_test" in data else data["X_train"]
                y_arr = data["y_test"] if "y_test" in data else data["y_train"]
                limit_rows = min(12, len(X_arr))
                for idx in range(limit_rows):
                    row_vals = [round(float(v), 4) for v in X_arr[idx][:max_neurons_per_layer]]
                    y_val = y_arr[idx]
                    if np.ndim(y_val) > 0 and len(y_val) > 1:
                        target_val = [round(float(v), 4) for v in y_val[:max_neurons_per_layer]]
                    else:
                        scalar_y = float(y_val[0]) if np.ndim(y_val) > 0 else float(y_val)
                        target_val = [round(scalar_y, 4)]
                    samples.append({
                        "index": idx + 1,
                        "inputs": row_vals,
                        "targets": target_val
                    })
            except Exception:
                pass

    cursor.execute("""
        SELECT mv.id, mv.version, mv.storage_key, mv.test_metrics_json
        FROM model_versions mv
        WHERE mv.project_id = ?
        ORDER BY mv.created_at DESC
        LIMIT 1
    """, (project_id,))
    mv_row = cursor.fetchone()

    trained_model_data = None
    if mv_row and mv_row["storage_key"] and os.path.exists(mv_row["storage_key"]):
        try:
            keras_model = tf.keras.models.load_model(mv_row["storage_key"])
            dense_layers = []
            for layer in keras_model.layers:
                weights = layer.get_weights()
                if len(weights) >= 2:
                    W, b = weights[0], weights[1]
                    if W.ndim == 2:
                        act_cfg = layer.get_config().get("activation", "relu")
                        dense_layers.append({
                            "name": layer.name,
                            "activation": act_cfg,
                            "W": W,
                            "b": b
                        })

            if len(dense_layers) > 0:
                layer_sizes = [min(max_neurons_per_layer, int(dense_layers[0]["W"].shape[0]))]
                layer_activations = ["linear"]
                weights_list = []
                biases_list = []

                for dl in dense_layers:
                    in_dim = min(max_neurons_per_layer, int(dl["W"].shape[0]))
                    out_dim = min(max_neurons_per_layer, int(dl["W"].shape[1]))
                    layer_sizes.append(out_dim)
                    layer_activations.append(dl["activation"])

                    w_slice = dl["W"][:in_dim, :out_dim]
                    b_slice = dl["b"][:out_dim]
                    weights_list.append([[round(float(val), 4) for val in row] for row in w_slice])
                    biases_list.append([round(float(val), 4) for val in b_slice])

                trained_model_data = {
                    "model_id": mv_row["id"],
                    "version": mv_row["version"],
                    "layer_sizes": layer_sizes,
                    "layer_activations": layer_activations,
                    "weights": weights_list,
                    "biases": biases_list
                }
        except Exception:
            trained_model_data = None

    conn.close()
    return {
        "project_id": project_id,
        "dataset_name": ds_row["name"] if ds_row else None,
        "feature_names": feature_names[:max_neurons_per_layer],
        "target_name": target_name,
        "samples": samples,
        "trained_model": trained_model_data
    }


