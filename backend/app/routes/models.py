import io
import os
import json
import time
import unicodedata

os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
import pandas as pd
import tensorflow as tf
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from app.database import get_db
from app.eda import read_csv_bytes_flexible, sanitize_cell_value
from app.security import (
    REVIEW_MODEL_ROLES,
    get_accessible_project_ids,
    get_current_user,
    get_system_policies_dict,
    get_system_quotas_dict,
    log_audit_event,
    verify_project_access,
)

router = APIRouter(prefix="/api/v1", tags=["models"])
_MODEL_CACHE: Dict[str, tuple] = {}


def _get_cached_keras_model(model_path: str):
    mtime = os.path.getmtime(model_path)
    cached = _MODEL_CACHE.get(model_path)
    if cached and cached[0] == mtime:
        return cached[1]
    loaded = tf.keras.models.load_model(model_path)
    _MODEL_CACHE[model_path] = (mtime, loaded)
    return loaded


def _classify_multiclass_risk(class_label: str, class_idx: int, num_classes: int) -> str:
    """Clasifica el nivel de riesgo semánticamente según la etiqueta predicha en modelos multiclase."""
    norm = unicodedata.normalize("NFKD", str(class_label or "")).encode("ascii", "ignore").decode("ascii").lower().strip()

    high_tokens = ("falla", "crit", "alto", "fraude", "riesgo", "mora", "fuga", "alerta", "peligro", "sever")
    med_tokens = ("degrad", "satur", "congest", "medio", "moder", "precauc", "advert", "inestab")
    low_tokens = ("operativ", "establ", "normal", "bajo", "salud", "segur", "legitim", "solvent", "optimo")

    if any(tok in norm for tok in high_tokens):
        return "ALTO"
    if any(tok in norm for tok in med_tokens):
        return "MEDIO"
    if any(tok in norm for tok in low_tokens):
        return "BAJO"

    if num_classes <= 1:
        return "BAJO"
    if class_idx == num_classes - 1:
        return "ALTO"
    if class_idx > 0:
        return "MEDIO"
    return "BAJO"


class StatusUpdateRequest(BaseModel):
    status: str
    actor_id: Optional[str] = None
    notes: Optional[str] = None


class ModelPredictRequest(BaseModel):
    features: Dict[str, Any]


class BatchPredictRequest(BaseModel):
    limit: Optional[int] = 20
    offset: Optional[int] = 0


@router.get("/projects/{project_id}/models")
def list_project_models(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT mv.*, tj.architecture_id, tj.dataset_id,
                   a.name as arch_name, a.family as arch_family, a.config_json as arch_config_json,
                   d.name as dataset_name, d.target as target_column, d.metadata_json as dataset_metadata_json
            FROM model_versions mv
            JOIN training_jobs tj ON mv.job_id = tj.id
            JOIN architectures a ON tj.architecture_id = a.id
            JOIN datasets d ON tj.dataset_id = d.id
            WHERE mv.project_id = %s
            ORDER BY mv.created_at DESC
            """,
            (project_id,),
        )
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["test_metrics"] = json.loads(d["test_metrics_json"])
            d["confusion_matrix"] = json.loads(d["confusion_matrix_json"])
            d["architecture_config"] = json.loads(d["arch_config_json"]) if d.get("arch_config_json") else None
            d["dataset_metadata"] = json.loads(d["dataset_metadata_json"]) if d.get("dataset_metadata_json") else None
            del d["test_metrics_json"]
            del d["confusion_matrix_json"]
            if "arch_config_json" in d:
                del d["arch_config_json"]
            if "dataset_metadata_json" in d:
                del d["dataset_metadata_json"]
            results.append(d)
        return results
    finally:
        conn.close()


@router.get("/models/catalog")
def list_models_catalog(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        cursor = conn.cursor()
        accessible = get_accessible_project_ids(conn, current_user)
        if accessible is not None and len(accessible) == 0:
            return []

        base_query = """
            SELECT mv.*, tj.architecture_id, tj.dataset_id,
                   p.name as project_name, p.description as project_description,
                   a.name as arch_name, a.family as arch_family, a.config_json as arch_config_json,
                   d.name as dataset_name, d.target as target_column, d.metadata_json as dataset_metadata_json
            FROM model_versions mv
            JOIN projects p ON mv.project_id = p.id
            JOIN training_jobs tj ON mv.job_id = tj.id
            JOIN architectures a ON tj.architecture_id = a.id
            JOIN datasets d ON tj.dataset_id = d.id
        """
        if accessible is None:
            cursor.execute(base_query + " ORDER BY mv.created_at DESC")
        else:
            cursor.execute(base_query + " WHERE mv.project_id = ANY(%s) ORDER BY mv.created_at DESC", (accessible,))
        rows = cursor.fetchall()

        source_area_cache: Dict[str, Dict[str, Any]] = {}
        results = []
        for r in rows:
            d = dict(r)
            d["test_metrics"] = json.loads(d["test_metrics_json"])
            d["confusion_matrix"] = json.loads(d["confusion_matrix_json"])
            d["architecture_config"] = json.loads(d["arch_config_json"]) if d.get("arch_config_json") else None
            ds_meta = json.loads(d["dataset_metadata_json"]) if d.get("dataset_metadata_json") else None
            d["dataset_metadata"] = ds_meta

            fusion_rep = (ds_meta or {}).get("fusion_report") if isinstance(ds_meta, dict) else None
            if isinstance(fusion_rep, dict) and fusion_rep.get("mode") == "cross_area_corporate_fusion":
                area_schemas: Dict[str, Any] = {}
                for contrib in fusion_rep.get("area_contributions") or []:
                    src_pid = contrib.get("project_id")
                    area_code = contrib.get("area_code")
                    if not src_pid or not area_code:
                        continue
                    if src_pid not in source_area_cache:
                        cursor.execute(
                            """
                            SELECT name, target, metadata_json
                            FROM datasets
                            WHERE project_id = %s
                            ORDER BY created_at ASC
                            LIMIT 1
                            """,
                            (src_pid,),
                        )
                        src_ds = cursor.fetchone()
                        if src_ds:
                            src_meta = json.loads(src_ds["metadata_json"] or "{}")
                            source_area_cache[src_pid] = {
                                "project_id": src_pid,
                                "project_name": contrib.get("project_name") or src_pid,
                                "dataset_name": src_ds["name"],
                                "target_column": src_ds["target"],
                                "columns_summary": [
                                    c for c in (src_meta.get("columns_summary") or [])
                                    if not c.get("is_target") and not c.get("excluded_reason")
                                ],
                                "preview": (src_meta.get("preview") or [])[:5],
                            }
                        else:
                            source_area_cache[src_pid] = None
                    if source_area_cache.get(src_pid):
                        area_schemas[area_code] = source_area_cache[src_pid]
                d["area_source_schemas"] = area_schemas

            del d["test_metrics_json"]
            del d["confusion_matrix_json"]
            d.pop("arch_config_json", None)
            d.pop("dataset_metadata_json", None)
            results.append(d)
        return results
    finally:
        conn.close()


@router.get("/models/{model_id}")
def get_model(
    model_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT mv.*, tj.architecture_id, tj.dataset_id,
                   a.name as arch_name, a.family as arch_family, a.config_json,
                   d.name as dataset_name, d.target, d.metadata_json as dataset_metadata_json
            FROM model_versions mv
            JOIN training_jobs tj ON mv.job_id = tj.id
            JOIN architectures a ON tj.architecture_id = a.id
            JOIN datasets d ON tj.dataset_id = d.id
            WHERE mv.id = %s
            """,
            (model_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        verify_project_access(conn, row["project_id"], current_user)

        d = dict(row)
        d["test_metrics"] = json.loads(d["test_metrics_json"])
        d["confusion_matrix"] = json.loads(d["confusion_matrix_json"])
        d["architecture_config"] = json.loads(d["config_json"])
        d["dataset_metadata"] = json.loads(d["dataset_metadata_json"]) if d.get("dataset_metadata_json") else None
        del d["test_metrics_json"]
        del d["confusion_matrix_json"]
        del d["config_json"]
        if "dataset_metadata_json" in d:
            del d["dataset_metadata_json"]
        return d
    finally:
        conn.close()


@router.put("/models/{model_id}/status")
def update_model_status(
    model_id: str,
    req: StatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    valid_statuses = ["Borrador", "En Revisión", "Aprobado", "Retirado", "APPROVED", "IN_REVIEW", "DRAFT", "RETIRED"]
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Estado de modelo no válido")

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, project_id, version, status FROM model_versions WHERE id = %s", (model_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")

        verify_project_access(conn, row["project_id"], current_user, allowed_roles=REVIEW_MODEL_ROLES)

        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        cursor.execute("UPDATE model_versions SET status = %s WHERE id = %s", (req.status, model_id))

        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "MODEL_STATUS_CHANGED",
            {
                "model_id": model_id,
                "version": row["version"],
                "previous_status": row["status"],
                "new_status": req.status,
                "notes": req.notes,
            },
        )
        conn.commit()
    finally:
        conn.close()
    return {"id": model_id, "status": req.status, "updated_at": now}


@router.get("/models/{model_id}/download")
def download_model_binary(
    model_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT project_id, storage_key, version FROM model_versions WHERE id = %s", (model_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        verify_project_access(conn, row["project_id"], current_user)
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "MODEL_EXPORTED",
            {"model_id": model_id, "version": row["version"], "format": "keras"},
        )
        conn.commit()
    finally:
        conn.close()

    path = row["storage_key"]
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="El archivo binario del modelo no se encuentra en el almacenamiento local")

    filename = f"neurolab_model_{row['version'].replace('.', '_')}.keras"
    return FileResponse(path, filename=filename, media_type="application/octet-stream")


@router.get("/models/{model_id}/download-spec")
def download_model_spec(
    model_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT project_id, storage_key, version FROM model_versions WHERE id = %s", (model_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        verify_project_access(conn, row["project_id"], current_user)
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "MODEL_EXPORTED",
            {"model_id": model_id, "version": row["version"], "format": "json_spec"},
        )
        conn.commit()
    finally:
        conn.close()

    spec_path = row["storage_key"].replace(".keras", "_spec.json")
    if not os.path.exists(spec_path):
        raise HTTPException(status_code=404, detail="La especificación JSON del modelo no se encuentra")

    filename = f"neurolab_spec_{row['version'].replace('.', '_')}.json"
    return FileResponse(spec_path, filename=filename, media_type="application/json")


@router.post("/models/{model_id}/predict")
def predict_with_model(
    model_id: str,
    req: ModelPredictRequest,
    current_user: dict = Depends(get_current_user),
):
    t0 = time.perf_counter()
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT mv.project_id,
                   mv.storage_key as model_path,
                   d.target as target_column,
                   d.storage_key as csv_path,
                   d.metadata_json,
                   d.input_shape
            FROM model_versions mv
            JOIN training_jobs tj ON mv.job_id = tj.id
            JOIN datasets d ON tj.dataset_id = d.id
            WHERE mv.id = %s
            """,
            (model_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        verify_project_access(conn, row["project_id"], current_user)
    finally:
        conn.close()

    eda = json.loads(row["metadata_json"] or "{}")
    target_col = row["target_column"] or eda.get("target_column", "target")
    problem_type = eda.get("problem_type", "binary_classification")
    feature_names = eda.get("feature_names", [])
    columns_summary = eda.get("columns_summary", [])
    target_classes = eda.get("target_classes") or ["0", "1"]
    scaler_params = eda.get("scaler_params")

    encoded_vec = np.zeros((1, len(feature_names)), dtype=float)
    col_map = {c["name"]: c for c in columns_summary}

    for idx, fname in enumerate(feature_names):
        if fname in req.features:
            try:
                encoded_vec[0, idx] = float(req.features[fname])
            except (ValueError, TypeError):
                encoded_vec[0, idx] = float(col_map.get(fname, {}).get("mean", 0.0))
        elif fname in col_map and col_map[fname].get("dtype") == "numeric":
            encoded_vec[0, idx] = float(col_map[fname].get("mean", 0.0))
        else:
            for col_info in columns_summary:
                if col_info.get("dtype") == "categorical" and not col_info.get("is_target"):
                    cname = col_info["name"]
                    prefix = f"{cname}_"
                    if fname.startswith(prefix):
                        cat_val = fname[len(prefix) :]
                        user_val = str(req.features.get(cname, ""))
                        encoded_vec[0, idx] = 1.0 if user_val == cat_val else 0.0
                        break

    log_cols = set(eda.get("log_transformed_columns") or [])
    if len(log_cols) > 0 and len(feature_names) > 0:
        for idx, fname in enumerate(feature_names):
            if fname in log_cols:
                encoded_vec[0, idx] = float(np.log1p(max(0.0, encoded_vec[0, idx])))

    if scaler_params and len(feature_names) > 0:
        s_type = scaler_params.get("type")
        if s_type == "minmax":
            mins = np.array(scaler_params.get("min", np.zeros(len(feature_names))), dtype=float)
            scales = np.array(scaler_params.get("scale", np.ones(len(feature_names))), dtype=float)
            if len(mins) == len(feature_names):
                encoded_vec = (encoded_vec - mins) * scales
        elif s_type == "robust":
            centers = np.array(scaler_params.get("center", np.zeros(len(feature_names))), dtype=float)
            scales = np.array(scaler_params.get("scale", np.ones(len(feature_names))), dtype=float)
            if len(centers) == len(feature_names):
                scales = np.where(scales == 0, 1.0, scales)
                encoded_vec = (encoded_vec - centers) / scales
        elif s_type != "none":
            means = np.array(scaler_params.get("mean", np.zeros(len(feature_names))), dtype=float)
            scales = np.array(scaler_params.get("scale", np.ones(len(feature_names))), dtype=float)
            if len(means) == len(feature_names):
                scales = np.where(scales == 0, 1.0, scales)
                encoded_vec = (encoded_vec - means) / scales
    elif row["csv_path"] and os.path.exists(row["csv_path"]) and len(feature_names) > 0:
        try:
            df_ref = pd.read_csv(row["csv_path"])
            if target_col in df_ref.columns:
                df_ref = df_ref.drop(columns=[target_col])
            X_ref = pd.get_dummies(df_ref, drop_first=True).reindex(columns=feature_names, fill_value=0).values.astype(float)
            sc = MinMaxScaler() if eda.get("scaler_applied") == "minmax" else StandardScaler()
            sc.fit(X_ref)
            encoded_vec = sc.transform(encoded_vec)
        except Exception:
            pass

    model_path = row["model_path"]
    if not model_path or not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="El binario .keras del modelo no está disponible en disco")

    keras_model = _get_cached_keras_model(model_path)
    expected_in = int(keras_model.input_shape[-1])
    if encoded_vec.shape[1] < expected_in:
        pad = np.zeros((1, expected_in - encoded_vec.shape[1]), dtype=float)
        encoded_vec = np.hstack([encoded_vec, pad])
    elif encoded_vec.shape[1] > expected_in:
        encoded_vec = encoded_vec[:, :expected_in]

    raw_out = keras_model.predict(encoded_vec, verbose=0)

    layer_traces = []
    in_all = [round(float(v), 4) for v in encoded_vec[0]]
    in_names = [
        feature_names[i] if i < len(feature_names) else f"input_{i + 1}"
        for i in range(int(encoded_vec.shape[1]))
    ]
    layer_traces.append({
        "name": "Capa de Entrada",
        "type": "Input",
        "units": int(encoded_vec.shape[1]),
        "activation": "z-score",
        "neurons": in_all,
        "neuron_names": in_names,
        "mean_activation": round(float(np.mean(np.abs(encoded_vec))), 4),
        "max_activation": round(float(np.max(np.abs(encoded_vec))) if encoded_vec.size > 0 else 0.0, 4),
        "active_ratio": round(float(np.mean(np.abs(encoded_vec) > 0.15)), 4),
    })

    curr_tensor = tf.convert_to_tensor(encoded_vec, dtype=tf.float32)
    first_dense_weights = None
    for idx_l, layer in enumerate(keras_model.layers):
        try:
            curr_tensor = layer(curr_tensor, training=False)
            arr = curr_tensor.numpy().flatten()
            l_cfg = layer.get_config()
            l_type = layer.__class__.__name__
            l_act = l_cfg.get("activation", "linear")
            is_last = idx_l == len(keras_model.layers) - 1
            if first_dense_weights is None and l_type == "Dense":
                w_list = layer.get_weights()
                if len(w_list) > 0 and w_list[0].ndim == 2:
                    first_dense_weights = w_list[0]
            max_layer_neurons = min(int(arr.size), 512)
            norm_neurons = [round(float(np.tanh(abs(v))), 4) for v in arr[:max_layer_neurons]]
            layer_traces.append({
                "name": "Capa de Salida" if is_last else f"Capa {idx_l + 1} ({l_type})",
                "type": "Output" if is_last else l_type,
                "units": int(arr.size),
                "activation": str(l_act),
                "neurons": norm_neurons,
                "mean_activation": round(float(np.mean(np.abs(arr))) if arr.size > 0 else 0.0, 4),
                "max_activation": round(float(np.max(np.abs(arr))) if arr.size > 0 else 0.0, 4),
                "active_ratio": round(float(np.mean(np.abs(arr) > 0.05)) if arr.size > 0 else 0.0, 4),
            })
        except Exception:
            pass

    feature_contributions = []
    if first_dense_weights is not None and len(feature_names) > 0:
        w_importance = np.mean(np.abs(first_dense_weights), axis=1)
        n_feats = min(len(feature_names), len(w_importance), encoded_vec.shape[1])
        raw_impacts = []
        for i in range(n_feats):
            fname = feature_names[i]
            scaled_val = float(encoded_vec[0, i])
            impact = abs(scaled_val) * float(w_importance[i]) + float(w_importance[i]) * 0.15
            raw_val = req.features.get(fname)
            if raw_val is None and "_" in fname:
                parts = fname.rsplit("_", 1)
                if parts[0] in req.features:
                    raw_val = f"{parts[1]} ({'Sí' if scaled_val > 0 else 'No'})"
            raw_impacts.append({
                "name": fname,
                "raw_value": str(raw_val if raw_val is not None else round(scaled_val, 2)),
                "scaled_value": round(scaled_val, 3),
                "impact": float(impact),
                "direction": "positive" if scaled_val >= 0 else "negative",
            })
        total_imp = sum(item["impact"] for item in raw_impacts) or 1.0
        for item in raw_impacts:
            item["importance_pct"] = round((item["impact"] / total_imp) * 100.0, 1)
        raw_impacts.sort(key=lambda x: x["importance_pct"], reverse=True)
        feature_contributions = raw_impacts[:8]

    latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)

    if problem_type == "regression":
        val = float(raw_out.flatten()[0])
        return {
            "problem_type": problem_type,
            "target_column": target_col,
            "prediction": round(val, 4),
            "predicted_label": f"{target_col}: {val:.3f}",
            "probability": None,
            "probabilities": None,
            "latency_ms": latency_ms,
            "layer_traces": layer_traces,
            "feature_contributions": feature_contributions,
        }
    elif problem_type == "multiclass_classification" and raw_out.shape[-1] > 1:
        probs = [float(p) for p in raw_out.flatten()]
        best_idx = int(np.argmax(probs))
        best_prob = round(probs[best_idx], 4)
        cls_name = target_classes[best_idx] if best_idx < len(target_classes) else str(best_idx)
        probs_dict = {
            (target_classes[i] if i < len(target_classes) else str(i)): round(p, 4)
            for i, p in enumerate(probs)
        }
        return {
            "problem_type": problem_type,
            "target_column": target_col,
            "prediction": cls_name,
            "predicted_label": f"{target_col} = {cls_name}",
            "probability": best_prob,
            "probabilities": probs_dict,
            "latency_ms": latency_ms,
            "layer_traces": layer_traces,
            "feature_contributions": feature_contributions,
        }
    else:
        prob_pos = float(raw_out.flatten()[0])
        prob_pos = max(0.0, min(1.0, prob_pos))
        cls_0 = target_classes[0] if len(target_classes) > 0 else "0"
        cls_1 = target_classes[1] if len(target_classes) > 1 else "1"
        pred_cls = cls_1 if prob_pos >= 0.5 else cls_0
        return {
            "problem_type": "binary_classification",
            "target_column": target_col,
            "prediction": pred_cls,
            "predicted_label": f"{target_col} = {pred_cls}",
            "probability": round(prob_pos, 4),
            "probabilities": {cls_0: round(1.0 - prob_pos, 4), cls_1: round(prob_pos, 4)},
            "latency_ms": latency_ms,
            "layer_traces": layer_traces,
            "feature_contributions": feature_contributions,
        }


@router.post("/models/{model_id}/predict-batch")
def predict_batch_with_model(
    model_id: str,
    req: BatchPredictRequest,
    current_user: dict = Depends(get_current_user),
):
    t0 = time.perf_counter()
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT mv.project_id,
                   mv.storage_key as model_path,
                   d.target as target_column,
                   d.storage_key as csv_path,
                   d.metadata_json,
                   d.name as dataset_name
            FROM model_versions mv
            JOIN training_jobs tj ON mv.job_id = tj.id
            JOIN datasets d ON tj.dataset_id = d.id
            WHERE mv.id = %s
            """,
            (model_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        verify_project_access(conn, row["project_id"], current_user)
    finally:
        conn.close()

    model_path = row["model_path"]
    csv_path = row["csv_path"]
    if not model_path or not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="El archivo .keras del modelo no existe en disco")
    if not csv_path or not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="El archivo CSV del dataset no existe en disco")

    eda = json.loads(row["metadata_json"] or "{}")
    target_col = row["target_column"] or eda.get("target_column", "target")
    problem_type = eda.get("problem_type", "binary_classification")
    feature_names = eda.get("feature_names", [])
    target_classes = eda.get("target_classes") or ["0", "1"]
    excluded_cols = set(eda.get("excluded_columns") or [])
    scaler_params = eda.get("scaler_params")

    df = pd.read_csv(csv_path)
    total_available = len(df)
    limit = max(1, min(int(req.limit or 20), 60))
    offset = max(0, min(int(req.offset or 0), max(0, total_available - 1)))
    df_slice = df.iloc[offset : offset + limit].copy()

    for col in df_slice.columns:
        if df_slice[col].isnull().sum() > 0:
            if pd.api.types.is_numeric_dtype(df_slice[col]):
                df_slice[col] = df_slice[col].fillna(df[col].median())
            else:
                mode_v = df[col].mode()
                df_slice[col] = df_slice[col].fillna(mode_v[0] if len(mode_v) > 0 else "Desconocido")

    raw_records = df_slice.to_dict(orient="records")
    drop_cols = [c for c in [target_col, *excluded_cols] if c in df_slice.columns]
    X_raw = df_slice.drop(columns=drop_cols)
    X_enc = pd.get_dummies(X_raw, drop_first=True).reindex(columns=feature_names, fill_value=0).values.astype(float)

    log_cols = set(eda.get("log_transformed_columns") or [])
    if len(log_cols) > 0 and len(feature_names) > 0:
        for idx, fname in enumerate(feature_names):
            if fname in log_cols:
                X_enc[:, idx] = np.log1p(np.maximum(0.0, X_enc[:, idx]))

    if scaler_params and len(feature_names) > 0:
        s_type = scaler_params.get("type")
        if s_type == "minmax":
            mins = np.array(scaler_params.get("min", np.zeros(len(feature_names))), dtype=float)
            scales = np.array(scaler_params.get("scale", np.ones(len(feature_names))), dtype=float)
            if len(mins) == len(feature_names):
                X_enc = (X_enc - mins) * scales
        elif s_type == "robust":
            centers = np.array(scaler_params.get("center", np.zeros(len(feature_names))), dtype=float)
            scales = np.array(scaler_params.get("scale", np.ones(len(feature_names))), dtype=float)
            if len(centers) == len(feature_names):
                scales = np.where(scales == 0, 1.0, scales)
                X_enc = (X_enc - centers) / scales
        elif s_type != "none":
            means = np.array(scaler_params.get("mean", np.zeros(len(feature_names))), dtype=float)
            scales = np.array(scaler_params.get("scale", np.ones(len(feature_names))), dtype=float)
            if len(means) == len(feature_names):
                scales = np.where(scales == 0, 1.0, scales)
                X_enc = (X_enc - means) / scales

    keras_model = _get_cached_keras_model(model_path)
    expected_in = int(keras_model.input_shape[-1])
    if X_enc.shape[1] < expected_in:
        X_enc = np.hstack([X_enc, np.zeros((len(X_enc), expected_in - X_enc.shape[1]), dtype=float)])
    elif X_enc.shape[1] > expected_in:
        X_enc = X_enc[:, :expected_in]

    raw_outs = keras_model.predict(X_enc, verbose=0)
    latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)

    items = []
    high_risk_count = 0
    for idx, rec in enumerate(raw_records):
        actual_val = rec.get(target_col)
        clean_features = {
            k: (
                None
                if pd.isna(v)
                else (float(v) if isinstance(v, (np.floating,)) else int(v) if isinstance(v, (np.integer,)) else v)
            )
            for k, v in rec.items()
            if k != target_col
        }
        if problem_type == "regression":
            pred_val = round(float(raw_outs[idx].flatten()[0]), 4)
            prob = None
            risk_level = "MEDIO"
            pred_label = f"{target_col}: {pred_val}"
        elif problem_type == "multiclass_classification" and raw_outs.shape[-1] > 1:
            probs = [float(p) for p in raw_outs[idx].flatten()]
            b_idx = int(np.argmax(probs))
            prob = round(probs[b_idx], 4)
            pred_val = target_classes[b_idx] if b_idx < len(target_classes) else str(b_idx)
            pred_label = f"{target_col} = {pred_val}"
            risk_level = _classify_multiclass_risk(str(pred_val), b_idx, len(probs))
            if risk_level == "ALTO":
                high_risk_count += 1
        else:
            p_pos = max(0.0, min(1.0, float(raw_outs[idx].flatten()[0])))
            prob = round(p_pos, 4)
            cls_0 = target_classes[0] if len(target_classes) > 0 else "0"
            cls_1 = target_classes[1] if len(target_classes) > 1 else "1"
            pred_val = cls_1 if p_pos >= 0.5 else cls_0
            pred_label = f"{target_col} = {pred_val}"
            risk_level = "ALTO" if p_pos >= 0.65 else ("MEDIO" if p_pos >= 0.40 else "BAJO")
            if p_pos >= 0.65:
                high_risk_count += 1

        items.append({
            "row_index": offset + idx + 1,
            "features": clean_features,
            "actual_target": None if pd.isna(actual_val) else str(actual_val),
            "prediction": pred_val,
            "predicted_label": pred_label,
            "probability": prob,
            "risk_level": risk_level,
        })

    items.sort(key=lambda x: x["probability"] if x["probability"] is not None else 0.0, reverse=True)
    return {
        "model_id": model_id,
        "dataset_name": row["dataset_name"],
        "target_column": target_col,
        "problem_type": problem_type,
        "total_scanned": len(items),
        "high_risk_count": high_risk_count,
        "latency_ms": latency_ms,
        "items": items,
    }


@router.post("/models/{model_id}/predict-csv")
async def predict_csv_with_model(
    model_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se admiten archivos en formato .csv.")

    t0 = time.perf_counter()
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT mv.project_id,
                   mv.version,
                   mv.storage_key as model_path,
                   d.target as target_column,
                   d.metadata_json,
                   d.name as dataset_name
            FROM model_versions mv
            JOIN training_jobs tj ON mv.job_id = tj.id
            JOIN datasets d ON tj.dataset_id = d.id
            WHERE mv.id = %s
            """,
            (model_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Modelo no encontrado")
        verify_project_access(conn, row["project_id"], current_user)
        quotas = get_system_quotas_dict(conn)
        policies = get_system_policies_dict(conn)
        max_mb = int(quotas.get("max_dataset_mb", 50))
    finally:
        conn.close()

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="El archivo CSV está vacío.")
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"El archivo excede el límite máximo permitido de {max_mb} MB.")
    if b"\x00" in contents[:4096]:
        raise HTTPException(status_code=400, detail="El archivo contiene bytes binarios no válidos para un CSV.")

    try:
        df = read_csv_bytes_flexible(contents)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo CSV: {exc}")

    if len(df) == 0:
        raise HTTPException(status_code=400, detail="El CSV no contiene filas de datos para evaluar.")

    max_rows = 2000
    truncated = len(df) > max_rows
    if truncated:
        df = df.iloc[:max_rows].copy()

    model_path = row["model_path"]
    if not model_path or not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="El archivo .keras del modelo no existe en disco")

    eda = json.loads(row["metadata_json"] or "{}")
    target_col = row["target_column"] or eda.get("target_column", "target")
    problem_type = eda.get("problem_type", "binary_classification")
    feature_names = eda.get("feature_names", [])
    columns_summary = eda.get("columns_summary", [])
    target_classes = eda.get("target_classes") or ["0", "1"]
    scaler_params = eda.get("scaler_params")

    expected_input_cols = [
        c for c in columns_summary if not c.get("is_target") and not c.get("excluded_reason")
    ]
    matched_columns = [c["name"] for c in expected_input_cols if c["name"] in df.columns]
    missing_columns = [c["name"] for c in expected_input_cols if c["name"] not in df.columns]

    if len(expected_input_cols) > 0 and len(matched_columns) == 0:
        raise HTTPException(
            status_code=400,
            detail="Ninguna columna del CSV coincide con las variables esperadas por este modelo. Descarga la plantilla CSV para ver el formato exacto.",
        )

    work_df = pd.DataFrame(index=df.index)
    for col_info in expected_input_cols:
        cname = col_info["name"]
        if col_info.get("dtype") == "numeric":
            default_val = float(col_info.get("mean") or 0.0)
            if cname in df.columns:
                work_df[cname] = pd.to_numeric(df[cname], errors="coerce").fillna(default_val)
            else:
                work_df[cname] = default_val
        else:
            top_vals = list((col_info.get("top_values") or {}).keys())
            default_cat = str(top_vals[0]) if top_vals else "Desconocido"
            if cname in df.columns:
                work_df[cname] = df[cname].fillna(default_cat).astype(str).str.strip()
            else:
                work_df[cname] = default_cat

    X_enc = np.zeros((len(work_df), len(feature_names)), dtype=float)
    col_map = {c["name"]: c for c in expected_input_cols}

    for idx, fname in enumerate(feature_names):
        if fname in work_df.columns and col_map.get(fname, {}).get("dtype") == "numeric":
            X_enc[:, idx] = work_df[fname].values.astype(float)
        else:
            for col_info in expected_input_cols:
                if col_info.get("dtype") == "categorical":
                    cname = col_info["name"]
                    prefix = f"{cname}_"
                    if fname.startswith(prefix):
                        cat_val = fname[len(prefix) :]
                        X_enc[:, idx] = (work_df[cname].astype(str) == cat_val).astype(float).values
                        break

    log_cols = set(eda.get("log_transformed_columns") or [])
    if len(log_cols) > 0 and len(feature_names) > 0:
        for idx, fname in enumerate(feature_names):
            if fname in log_cols:
                X_enc[:, idx] = np.log1p(np.maximum(0.0, X_enc[:, idx]))

    if scaler_params and len(feature_names) > 0:
        s_type = scaler_params.get("type")
        if s_type == "minmax":
            mins = np.array(scaler_params.get("min", np.zeros(len(feature_names))), dtype=float)
            scales = np.array(scaler_params.get("scale", np.ones(len(feature_names))), dtype=float)
            if len(mins) == len(feature_names):
                X_enc = (X_enc - mins) * scales
        elif s_type == "robust":
            centers = np.array(scaler_params.get("center", np.zeros(len(feature_names))), dtype=float)
            scales = np.array(scaler_params.get("scale", np.ones(len(feature_names))), dtype=float)
            if len(centers) == len(feature_names):
                scales = np.where(scales == 0, 1.0, scales)
                X_enc = (X_enc - centers) / scales
        elif s_type != "none":
            means = np.array(scaler_params.get("mean", np.zeros(len(feature_names))), dtype=float)
            scales = np.array(scaler_params.get("scale", np.ones(len(feature_names))), dtype=float)
            if len(means) == len(feature_names):
                scales = np.where(scales == 0, 1.0, scales)
                X_enc = (X_enc - means) / scales

    keras_model = _get_cached_keras_model(model_path)
    expected_in = int(keras_model.input_shape[-1])
    if X_enc.shape[1] < expected_in:
        X_enc = np.hstack([X_enc, np.zeros((len(X_enc), expected_in - X_enc.shape[1]), dtype=float)])
    elif X_enc.shape[1] > expected_in:
        X_enc = X_enc[:, :expected_in]

    raw_outs = keras_model.predict(X_enc, verbose=0)
    latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)

    pred_values = []
    prob_values = []
    risk_levels = []
    high_risk = 0
    medium_risk = 0
    low_risk = 0
    class_counts: Dict[str, int] = {}
    items = []

    raw_records = df.to_dict(orient="records")
    for idx, rec in enumerate(raw_records):
        clean_features = {str(k): sanitize_cell_value(v) for k, v in rec.items() if str(k) != target_col}
        if problem_type == "regression":
            pred_val = round(float(raw_outs[idx].flatten()[0]), 2)
            prob = None
            risk_level = "MEDIO"
            medium_risk += 1
            pred_label = f"{pred_val:,.2f}"
        elif problem_type == "multiclass_classification" and raw_outs.shape[-1] > 1:
            probs = [float(p) for p in raw_outs[idx].flatten()]
            b_idx = int(np.argmax(probs))
            prob = round(probs[b_idx], 4)
            pred_val = target_classes[b_idx] if b_idx < len(target_classes) else str(b_idx)
            pred_label = str(pred_val)
            class_counts[pred_label] = class_counts.get(pred_label, 0) + 1
            risk_level = _classify_multiclass_risk(pred_label, b_idx, len(probs))
            if risk_level == "ALTO":
                high_risk += 1
            elif risk_level == "MEDIO":
                medium_risk += 1
            else:
                low_risk += 1
        else:
            p_pos = max(0.0, min(1.0, float(raw_outs[idx].flatten()[0])))
            prob = round(p_pos, 4)
            cls_0 = target_classes[0] if len(target_classes) > 0 else "0"
            cls_1 = target_classes[1] if len(target_classes) > 1 else "1"
            pred_val = cls_1 if p_pos >= 0.5 else cls_0
            pred_label = str(pred_val)
            class_counts[pred_label] = class_counts.get(pred_label, 0) + 1
            if p_pos >= 0.65:
                risk_level = "ALTO"
                high_risk += 1
            elif p_pos >= 0.40:
                risk_level = "MEDIO"
                medium_risk += 1
            else:
                risk_level = "BAJO"
                low_risk += 1

        pred_values.append(pred_val)
        prob_values.append(round(prob * 100.0, 2) if prob is not None else "")
        risk_levels.append(risk_level)

        if idx < 200:
            items.append({
                "row_index": idx + 1,
                "features": clean_features,
                "prediction": pred_val,
                "predicted_label": pred_label,
                "probability": prob,
                "risk_level": risk_level,
            })

    export_df = df.copy()
    export_df["prediccion_ia"] = pred_values
    if problem_type != "regression":
        export_df["probabilidad_pct"] = prob_values
        export_df["nivel_riesgo"] = risk_levels
    csv_buf = io.StringIO()
    export_df.to_csv(csv_buf, index=False)

    if policies.get("strict_inference_audit", True):
        conn = get_db()
        try:
            log_audit_event(
                conn,
                current_user["id"],
                current_user["display_name"],
                row["project_id"],
                "MODEL_BATCH_PREDICTION",
                {
                    "model_id": model_id,
                    "version": row["version"],
                    "filename": file.filename,
                    "rows_evaluated": len(df),
                    "high_risk_count": high_risk,
                },
            )
            conn.commit()
        finally:
            conn.close()

    avg_prediction = (
        round(float(np.mean(pred_values)), 2)
        if problem_type == "regression" and len(pred_values) > 0
        else None
    )

    return {
        "model_id": model_id,
        "filename": file.filename,
        "dataset_name": row["dataset_name"],
        "target_column": target_col,
        "problem_type": problem_type,
        "total_rows": len(df),
        "truncated": truncated,
        "matched_columns": matched_columns,
        "missing_columns": missing_columns,
        "high_risk_count": high_risk,
        "medium_risk_count": medium_risk,
        "low_risk_count": low_risk,
        "avg_prediction": avg_prediction,
        "class_counts": class_counts,
        "latency_ms": latency_ms,
        "items": items,
        "csv_content": csv_buf.getvalue(),
    }


@router.get("/projects/{project_id}/visualizer-state")
def get_project_visualizer_state(
    project_id: str,
    max_neurons_per_layer: int = 12,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user)
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, name, input_shape, target, metadata_json, storage_key
            FROM datasets
            WHERE project_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (project_id,),
        )
        ds_row = cursor.fetchone()

        samples = []
        feature_names = []
        target_name = "target"

        if ds_row:
            target_name = ds_row["target"] or "target"
            try:
                eda = json.loads(ds_row["metadata_json"] or "{}")
                feature_names = eda.get("feature_names") or [
                    c["name"] for c in eda.get("columns_summary", []) if c["name"] != target_name
                ]
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
                            "targets": target_val,
                        })
                except Exception:
                    pass

        cursor.execute(
            """
            SELECT mv.id, mv.version, mv.storage_key, mv.test_metrics_json
            FROM model_versions mv
            WHERE mv.project_id = %s
            ORDER BY mv.created_at DESC
            LIMIT 1
            """,
            (project_id,),
        )
        mv_row = cursor.fetchone()

        trained_model_data = None
        if mv_row and mv_row["storage_key"] and os.path.exists(mv_row["storage_key"]):
            try:
                keras_model = _get_cached_keras_model(mv_row["storage_key"])
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
                                "b": b,
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
                        "test_metrics": json.loads(mv_row["test_metrics_json"]) if mv_row["test_metrics_json"] else None,
                        "layer_sizes": layer_sizes,
                        "layer_activations": layer_activations,
                        "weights": weights_list,
                        "biases": biases_list,
                    }
            except Exception:
                trained_model_data = None

        return {
            "project_id": project_id,
            "dataset_name": ds_row["name"] if ds_row else None,
            "feature_names": feature_names[:max_neurons_per_layer],
            "target_name": target_name,
            "samples": samples,
            "trained_model": trained_model_data,
        }
    finally:
        conn.close()
