import os
import json
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.database import get_db
from app.eda import perform_eda_and_preprocess
from app.sample_data import generate_sample_csvs

router = APIRouter(prefix="/api/v1", tags=["datasets"])

@router.get("/projects/{project_id}/datasets")
def list_project_datasets(project_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, project_id, name, version, input_shape, target, metadata_json, splits_json, created_at
        FROM datasets
        WHERE project_id = ?
        ORDER BY created_at DESC
    """, (project_id,))
    rows = cursor.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["metadata"] = json.loads(d["metadata_json"])
        d["splits"] = json.loads(d["splits_json"])
        del d["metadata_json"]
        del d["splits_json"]
        results.append(d)
    conn.close()
    return results

@router.post("/projects/{project_id}/datasets/upload")
async def upload_dataset(
    project_id: str,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    target_column: Optional[str] = Form(None),
    scaler_type: Optional[str] = Form("standard"),
    actor_id: Optional[str] = Form("usr-admin")
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Formato no admitido. Solo se permiten archivos .csv estructurados.")

    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "datasets")
    os.makedirs(data_dir, exist_ok=True)

    file_id = f"ds-{uuid.uuid4().hex[:8]}"
    save_filename = f"{file_id}.csv"
    dest_path = os.path.join(data_dir, save_filename)

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo excede el límite máximo permitido de 50MB.")

    with open(dest_path, "wb") as f:
        f.write(contents)

    try:
        eda_result, splits_file = perform_eda_and_preprocess(
            dest_path,
            target_column=target_column if target_column else None,
            scaler_type=scaler_type or "standard"
        )
    except Exception as e:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(status_code=400, detail=f"Error durante el análisis exploratorio (EDA): {str(e)}")

    ds_name = name or file.filename.replace(".csv", "").replace("_", " ").title()
    now = datetime.utcnow().isoformat()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO datasets 
        (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
        VALUES (?, ?, ?, '1.0.0', ?, ?, ?, ?, ?, ?)
    """, (
        file_id, project_id, ds_name, dest_path,
        json.dumps(eda_result), eda_result["input_shape"],
        eda_result["target_column"], json.dumps(eda_result["splits"]), now
    ))

    audit_id = f"aud-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
        INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at)
        VALUES (?, ?, 'Usuario', ?, 'DATASET_UPLOADED', ?, ?)
    """, (
        audit_id, actor_id, project_id,
        json.dumps({"dataset_id": file_id, "name": ds_name, "rows": eda_result["total_rows"]}),
        now
    ))

    conn.commit()
    conn.close()

    return {
        "id": file_id,
        "project_id": project_id,
        "name": ds_name,
        "version": "1.0.0",
        "input_shape": eda_result["input_shape"],
        "target": eda_result["target_column"],
        "metadata": eda_result,
        "splits": eda_result["splits"],
        "created_at": now
    }

@router.post("/projects/{project_id}/datasets/seed-sample")
def seed_sample_dataset(project_id: str, sample_type: str = "churn"):
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "datasets")
    samples = generate_sample_csvs(data_dir)

    selected_csv = samples["churn"] if sample_type == "churn" else samples["credit"]
    ds_name = "Telecom Customer Churn (EDA Certificado)" if sample_type == "churn" else "Credit Default Risk Assessment"

    file_id = f"ds-sample-{sample_type}-{uuid.uuid4().hex[:6]}"
    dest_path = os.path.join(data_dir, f"{file_id}.csv")

    with open(selected_csv, "rb") as sf:
        with open(dest_path, "wb") as df:
            df.write(sf.read())

    eda_result, splits_file = perform_eda_and_preprocess(dest_path)
    now = datetime.utcnow().isoformat()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO datasets 
        (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
        VALUES (?, ?, ?, '1.0.0', ?, ?, ?, ?, ?, ?)
    """, (
        file_id, project_id, ds_name, dest_path,
        json.dumps(eda_result), eda_result["input_shape"],
        eda_result["target_column"], json.dumps(eda_result["splits"]), now
    ))

    audit_id = f"aud-{uuid.uuid4().hex[:8]}"
    cursor.execute("""
        INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at)
        VALUES (?, 'system', 'Sistema Demo', ?, 'DATASET_SEED', ?, ?)
    """, (audit_id, project_id, json.dumps({"dataset_id": file_id, "type": sample_type}), now))

    conn.commit()
    conn.close()

    return {
        "id": file_id,
        "project_id": project_id,
        "name": ds_name,
        "version": "1.0.0",
        "input_shape": eda_result["input_shape"],
        "target": eda_result["target_column"],
        "metadata": eda_result,
        "splits": eda_result["splits"],
        "created_at": now
    }

@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, project_id, name, version, input_shape, target, metadata_json, splits_json, created_at
        FROM datasets WHERE id = ?
    """, (dataset_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    d = dict(row)
    d["metadata"] = json.loads(d["metadata_json"])
    d["splits"] = json.loads(d["splits_json"])
    del d["metadata_json"]
    del d["splits_json"]
    return d

