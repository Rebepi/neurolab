import os
import re
import json
import uuid
import shutil
from datetime import datetime, timezone
from typing import Optional, List
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app.database import get_db
from app.eda import (
    analyze_dataset_for_auto_clean,
    perform_eda_and_preprocess,
    read_csv_bytes_flexible,
    read_csv_flexible,
    sanitize_dataframe_records,
)
from app.fusion import fuse_intra_area_datasets
from app.sample_data import generate_sample_csvs
from app.security import (
    WRITE_PROJECT_ROLES,
    get_current_user,
    get_system_quotas_dict,
    log_audit_event,
    verify_project_access,
)

router = APIRouter(prefix="/api/v1", tags=["datasets"])


class FuseDatasetsRequest(BaseModel):
    dataset_ids: List[str]
    name: Optional[str] = None
    strategy: Optional[str] = "union"
    deduplicate: Optional[bool] = True
    scaler_type: Optional[str] = "standard"
    actor_id: Optional[str] = None


class CleanDatasetRequest(BaseModel):
    name: Optional[str] = None
    target_column: Optional[str] = None
    missing_strategy: Optional[str] = "median_mode"
    drop_duplicates: Optional[bool] = False
    outlier_strategy: Optional[str] = "none"
    drop_columns: Optional[List[str]] = None
    scaler_type: Optional[str] = "standard"
    split_ratio: Optional[str] = "70/15/15"
    normalize_text: Optional[bool] = False
    extract_dates: Optional[bool] = False
    group_rare_categories: Optional[bool] = False
    log_transform_skewed: Optional[bool] = False
    stratify_split: Optional[bool] = True


def _parse_drop_columns(raw_val: Optional[str]) -> List[str]:
    if not raw_val or not raw_val.strip():
        return []
    text = raw_val.strip()
    if text.startswith("["):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            pass
    return [c.strip() for c in text.split(",") if c.strip()]


def _derive_raw_csv_path(storage_key: Optional[str]) -> Optional[str]:
    if not storage_key or not storage_key.lower().endswith(".csv"):
        return None
    return f"{storage_key[:-4]}_raw.csv"


def _resolve_dataset_csv(storage_key: Optional[str], source: str = "raw"):
    if not storage_key:
        return None, False, "clean"
    raw_candidate = _derive_raw_csv_path(storage_key)
    has_raw_version = bool(raw_candidate and os.path.exists(raw_candidate))
    req_source = (source or "raw").lower()
    if req_source == "raw" and has_raw_version:
        return raw_candidate, True, "raw"
    return storage_key, has_raw_version, "clean" if req_source == "clean" else ("raw" if not has_raw_version else "clean")


def _get_datasets_dir() -> str:
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "datasets")
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


def _cleanup_dataset_files(storage_key: Optional[str]):
    if not storage_key:
        return
    candidates = [
        storage_key,
        storage_key.replace(".csv", "_splits.npz"),
        _derive_raw_csv_path(storage_key),
    ]
    raw_path = _derive_raw_csv_path(storage_key)
    if raw_path:
        candidates.append(raw_path.replace(".csv", "_splits.npz"))
    for path in candidates:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


@router.get("/projects/{project_id}/datasets")
def list_project_datasets(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, project_id, name, version, input_shape, target, metadata_json, splits_json, created_at
            FROM datasets
            WHERE project_id = %s
            ORDER BY created_at DESC
            """,
            (project_id,),
        )
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["metadata"] = json.loads(d["metadata_json"])
            d["splits"] = json.loads(d["splits_json"])
            del d["metadata_json"]
            del d["splits_json"]
            results.append(d)
        return results
    finally:
        conn.close()


@router.post("/projects/{project_id}/datasets/upload")
async def upload_dataset(
    project_id: str,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    target_column: Optional[str] = Form(None),
    scaler_type: Optional[str] = Form("standard"),
    missing_strategy: Optional[str] = Form("median_mode"),
    drop_duplicates: Optional[bool] = Form(False),
    outlier_strategy: Optional[str] = Form("none"),
    drop_columns: Optional[str] = Form(None),
    split_ratio: Optional[str] = Form("70/15/15"),
    normalize_text: Optional[bool] = Form(False),
    extract_dates: Optional[bool] = Form(False),
    group_rare_categories: Optional[bool] = Form(False),
    log_transform_skewed: Optional[bool] = Form(False),
    stratify_split: Optional[bool] = Form(True),
    actor_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Formato no admitido. Solo se permiten archivos .csv estructurados.")

    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user, allowed_roles=WRITE_PROJECT_ROLES)
        quotas = get_system_quotas_dict(conn)
        max_mb = int(quotas.get("max_dataset_mb", 50))
    finally:
        conn.close()

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="El archivo CSV está vacío.")
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"El archivo excede el límite máximo permitido de {max_mb}MB.")

    if b"\x00" in contents[:4096]:
        raise HTTPException(status_code=400, detail="El archivo contiene bytes binarios no válidos para un CSV.")

    data_dir = _get_datasets_dir()
    file_id = f"ds-{uuid.uuid4().hex[:8]}"
    dest_path = os.path.join(data_dir, f"{file_id}.csv")
    raw_path = os.path.join(data_dir, f"{file_id}_raw.csv")

    with open(raw_path, "wb") as f:
        f.write(contents)

    parsed_drops = _parse_drop_columns(drop_columns)

    try:
        eda_result, splits_file = perform_eda_and_preprocess(
            raw_path,
            target_column=target_column if target_column else None,
            scaler_type=scaler_type or "standard",
            missing_strategy=missing_strategy or "median_mode",
            drop_duplicates=bool(drop_duplicates),
            outlier_strategy=outlier_strategy or "none",
            drop_columns=parsed_drops,
            split_ratio=split_ratio or "70/15/15",
            save_cleaned_path=dest_path,
            normalize_text=bool(normalize_text),
            extract_dates=bool(extract_dates),
            group_rare_categories=bool(group_rare_categories),
            log_transform_skewed=bool(log_transform_skewed),
            stratify_split=True if stratify_split is None else bool(stratify_split),
        )
        if eda_result.get("total_rows", 0) < 5 or eda_result.get("total_columns", 0) < 2:
            raise ValueError("El dataset debe contener al menos 5 filas y 2 columnas (variables + target).")
    except Exception as e:
        _cleanup_dataset_files(dest_path)
        raise HTTPException(status_code=400, detail=f"Error durante el análisis exploratorio (EDA): {str(e)}")

    ds_name = name or file.filename.replace(".csv", "").replace("_", " ").title()
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO datasets
            (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
            VALUES (%s, %s, %s, '1.0.0', %s, %s, %s, %s, %s, %s)
            """,
            (
                file_id,
                project_id,
                ds_name,
                dest_path,
                json.dumps(eda_result),
                eda_result["input_shape"],
                eda_result["target_column"],
                json.dumps(eda_result["splits"]),
                now,
            ),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            project_id,
            "DATASET_UPLOADED",
            {
                "dataset_id": file_id,
                "name": ds_name,
                "rows": eda_result["total_rows"],
                "cleaning": eda_result.get("cleaning_report", {}),
            },
        )
        conn.commit()
    finally:
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
        "created_at": now,
    }


@router.post("/projects/{project_id}/datasets/analyze-upload")
async def analyze_upload_dataset(
    project_id: str,
    file: UploadFile = File(...),
    target_column: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Formato no admitido. Solo se permiten archivos .csv.")

    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user, allowed_roles=WRITE_PROJECT_ROLES)
        quotas = get_system_quotas_dict(conn)
        max_mb = int(quotas.get("max_dataset_mb", 50))
    finally:
        conn.close()

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="El archivo CSV está vacío.")
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"El archivo excede el límite máximo de {max_mb}MB.")
    if b"\x00" in contents[:4096]:
        raise HTTPException(status_code=400, detail="El archivo contiene bytes binarios no válidos para un CSV.")

    try:
        df = read_csv_bytes_flexible(contents)
        return analyze_dataset_for_auto_clean(df, target_column=target_column or None)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo diagnosticar el CSV: {str(exc)}")


@router.get("/datasets/{dataset_id}/auto-clean-plan")
def get_dataset_auto_clean_plan(
    dataset_id: str,
    target_column: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, project_id, target, storage_key FROM datasets WHERE id = %s",
            (dataset_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        verify_project_access(conn, row["project_id"], current_user)
    finally:
        conn.close()

    csv_path, _, _ = _resolve_dataset_csv(row["storage_key"], "raw")
    if not csv_path or not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="Archivo CSV del dataset no encontrado en disco")

    try:
        df = read_csv_flexible(csv_path)
        return analyze_dataset_for_auto_clean(df, target_column=target_column or row["target"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo generar el plan automático: {str(exc)}")


@router.get("/datasets/{dataset_id}/rows")
def get_dataset_rows(
    dataset_id: str,
    source: str = "raw",
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    only_nulls: bool = False,
    sort_by: Optional[str] = None,
    sort_dir: str = "asc",
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, project_id, name, target, storage_key, metadata_json FROM datasets WHERE id = %s",
            (dataset_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        verify_project_access(conn, row["project_id"], current_user)
    finally:
        conn.close()

    csv_path, has_raw_version, effective_source = _resolve_dataset_csv(row["storage_key"], source)
    if not csv_path or not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="Archivo CSV del dataset no encontrado en disco")

    df = read_csv_flexible(csv_path)
    total_rows = int(len(df))
    total_null_rows = int(df.isna().any(axis=1).sum())
    total_null_cells = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())
    columns = list(df.columns)

    if only_nulls:
        df = df[df.isna().any(axis=1)]

    if search and search.strip():
        term = search.strip().lower()
        mask = pd.Series(False, index=df.index)
        for col in df.columns:
            mask = mask | df[col].fillna("").astype(str).str.lower().str.contains(term, regex=False, na=False)
        df = df[mask]

    if sort_by and sort_by in df.columns:
        ascending = (sort_dir or "asc").lower() != "desc"
        df = df.sort_values(by=sort_by, ascending=ascending, na_position="last", kind="mergesort")

    filtered_rows = int(len(df))
    safe_page = max(1, int(page))
    safe_size = max(1, min(int(page_size), 100))
    start = (safe_page - 1) * safe_size
    end = start + safe_size
    df_page = df.iloc[start:end]

    meta = json.loads(row["metadata_json"] or "{}")
    target_col = row["target"] or meta.get("target_column") or (columns[-1] if columns else "target")

    return {
        "dataset_id": dataset_id,
        "source": effective_source,
        "has_raw_version": has_raw_version,
        "columns": columns,
        "target_column": target_col,
        "total_rows": total_rows,
        "filtered_rows": filtered_rows,
        "total_null_rows": total_null_rows,
        "total_null_cells": total_null_cells,
        "duplicate_rows": duplicate_rows,
        "page": safe_page,
        "page_size": safe_size,
        "rows": sanitize_dataframe_records(df_page),
    }


@router.get("/datasets/{dataset_id}/download")
def download_dataset_csv(
    dataset_id: str,
    source: str = "raw",
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, project_id, name, version, storage_key FROM datasets WHERE id = %s",
            (dataset_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        verify_project_access(conn, row["project_id"], current_user)

        csv_path, _, effective_source = _resolve_dataset_csv(row["storage_key"], source)
        if not csv_path or not os.path.exists(csv_path):
            raise HTTPException(status_code=404, detail="Archivo CSV del dataset no encontrado en disco")

        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "DATASET_EXPORTED",
            {"dataset_id": dataset_id, "name": row["name"], "source": effective_source},
        )
        conn.commit()
    finally:
        conn.close()

    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", row["name"]).strip("_").lower() or dataset_id
    filename = f"{slug}_{effective_source}_v{row['version'].replace('.', '_')}.csv"
    return FileResponse(csv_path, filename=filename, media_type="text/csv")


@router.post("/datasets/{dataset_id}/clean")
def clean_existing_dataset(
    dataset_id: str,
    req: CleanDatasetRequest,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, project_id, name, version, storage_key, target, metadata_json FROM datasets WHERE id = %s",
            (dataset_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")

        verify_project_access(conn, row["project_id"], current_user, allowed_roles=WRITE_PROJECT_ROLES)

        source_csv, _, _ = _resolve_dataset_csv(row["storage_key"], "raw")
        if not source_csv or not os.path.exists(source_csv):
            raise HTTPException(status_code=404, detail="Archivo fuente CSV no encontrado en disco")

        data_dir = _get_datasets_dir()
        new_id = f"ds-clean-{uuid.uuid4().hex[:8]}"
        new_raw_path = os.path.join(data_dir, f"{new_id}_raw.csv")
        new_clean_path = os.path.join(data_dir, f"{new_id}.csv")
        shutil.copy2(source_csv, new_raw_path)

        prev_meta = json.loads(row["metadata_json"] or "{}")
        target_col = req.target_column or row["target"] or prev_meta.get("target_column")

        try:
            eda_result, _ = perform_eda_and_preprocess(
                new_raw_path,
                target_column=target_col,
                scaler_type=req.scaler_type or "standard",
                missing_strategy=req.missing_strategy or "median_mode",
                drop_duplicates=bool(req.drop_duplicates),
                outlier_strategy=req.outlier_strategy or "none",
                drop_columns=req.drop_columns or [],
                split_ratio=req.split_ratio or "70/15/15",
                save_cleaned_path=new_clean_path,
                normalize_text=bool(req.normalize_text),
                extract_dates=bool(req.extract_dates),
                group_rare_categories=bool(req.group_rare_categories),
                log_transform_skewed=bool(req.log_transform_skewed),
                stratify_split=True if req.stratify_split is None else bool(req.stratify_split),
            )
        except Exception as exc:
            _cleanup_dataset_files(new_clean_path)
            raise HTTPException(status_code=400, detail=f"Error al limpiar el dataset: {str(exc)}")

        cursor.execute("SELECT COUNT(*) FROM datasets WHERE project_id = %s", (row["project_id"],))
        ds_count = cursor.fetchone()[0] + 1
        version_tag = f"1.{ds_count}.0-clean"
        ds_name = (req.name or "").strip() or f"{row['name']} (Limpio)"
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

        cursor.execute(
            """
            INSERT INTO datasets
            (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                new_id,
                row["project_id"],
                ds_name,
                version_tag,
                new_clean_path,
                json.dumps(eda_result),
                eda_result["input_shape"],
                eda_result["target_column"],
                json.dumps(eda_result["splits"]),
                now,
            ),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "DATASET_CLEANED",
            {
                "source_dataset_id": dataset_id,
                "new_dataset_id": new_id,
                "cleaning_report": eda_result.get("cleaning_report", {}),
            },
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "id": new_id,
        "project_id": row["project_id"],
        "name": ds_name,
        "version": version_tag,
        "input_shape": eda_result["input_shape"],
        "target": eda_result["target_column"],
        "metadata": eda_result,
        "splits": eda_result["splits"],
        "created_at": now,
    }


@router.post("/projects/{project_id}/datasets/seed-sample")
def seed_sample_dataset(
    project_id: str,
    sample_type: str = "retencion",
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user, allowed_roles=WRITE_PROJECT_ROLES)
    finally:
        conn.close()

    data_dir = _get_datasets_dir()
    samples = generate_sample_csvs(data_dir)

    catalog = {
        "retencion": (samples["retencion"], "Área 01 · Retención de Clientes 15K (Fuga)", "fuga"),
        "churn": (samples["retencion"], "Área 01 · Retención de Clientes 15K (Fuga)", "fuga"),
        "red_noc": (samples["red_noc"], "Área 02 · Telemetría Red NOC 12K (3 Estados)", "estado_nodo"),
        "clinical": (samples["red_noc"], "Área 02 · Telemetría Red NOC 12K (3 Estados)", "estado_nodo"),
        "antifraude": (samples["antifraude"], "Área 03 · Transacciones Antifraude 12K (SIM/Roaming)", "fraude"),
        "credit": (samples["antifraude"], "Área 03 · Transacciones Antifraude 12K (SIM/Roaming)", "fraude"),
        "comercial_ltv": (samples["comercial_ltv"], "Área 04 · Proyección Comercial LTV 10K (USD)", "valor_anual_usd"),
    }
    selected_csv, ds_name, target_col = catalog.get(sample_type, catalog["retencion"])

    file_id = f"ds-sample-{sample_type}-{uuid.uuid4().hex[:6]}"
    dest_path = os.path.join(data_dir, f"{file_id}.csv")

    with open(selected_csv, "rb") as sf:
        with open(dest_path, "wb") as df:
            df.write(sf.read())

    eda_result, _ = perform_eda_and_preprocess(dest_path, target_column=target_col)
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO datasets
            (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
            VALUES (%s, %s, %s, '1.0.0', %s, %s, %s, %s, %s, %s)
            """,
            (
                file_id,
                project_id,
                ds_name,
                dest_path,
                json.dumps(eda_result),
                eda_result["input_shape"],
                eda_result["target_column"],
                json.dumps(eda_result["splits"]),
                now,
            ),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            project_id,
            "DATASET_SEED",
            {"dataset_id": file_id, "type": sample_type},
        )
        conn.commit()
    finally:
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
        "created_at": now,
    }


@router.post("/projects/{project_id}/datasets/fuse")
def fuse_project_datasets(
    project_id: str,
    req: FuseDatasetsRequest,
    current_user: dict = Depends(get_current_user),
):
    if len(req.dataset_ids) < 2:
        raise HTTPException(status_code=400, detail="Selecciona al menos 2 datasets para fusionar.")

    conn = get_db()
    try:
        verify_project_access(conn, project_id, current_user, allowed_roles=WRITE_PROJECT_ROLES)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, project_id, name, version, storage_key, metadata_json, target FROM datasets WHERE project_id = %s AND id = ANY(%s)",
            (project_id, req.dataset_ids),
        )
        rows = [dict(r) for r in cursor.fetchall()]

        if len(rows) < 2:
            raise HTTPException(status_code=404, detail="No se encontraron al menos 2 datasets válidos dentro de esta área.")

        data_dir = _get_datasets_dir()
        fused_id = f"ds-fused-{uuid.uuid4().hex[:8]}"
        dest_path = os.path.join(data_dir, f"{fused_id}.csv")

        try:
            eda_result, _, fusion_report = fuse_intra_area_datasets(
                rows,
                dest_path,
                merge_strategy=req.strategy or "union",
                deduplicate=bool(req.deduplicate),
                scaler_type=req.scaler_type or "standard",
            )
        except Exception as exc:
            _cleanup_dataset_files(dest_path)
            raise HTTPException(status_code=400, detail=str(exc))

        cursor.execute("SELECT COUNT(*) FROM datasets WHERE project_id = %s", (project_id,))
        ds_count = cursor.fetchone()[0] + 1
        version_tag = f"2.{ds_count}.0"
        ds_name = req.name or f"Dataset Maestro Fusionado ({len(rows)} fuentes · {eda_result['total_rows']:,} filas)"
        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

        cursor.execute(
            """
            INSERT INTO datasets
            (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                fused_id,
                project_id,
                ds_name,
                version_tag,
                dest_path,
                json.dumps(eda_result),
                eda_result["input_shape"],
                eda_result["target_column"],
                json.dumps(eda_result["splits"]),
                now,
            ),
        )
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            project_id,
            "DATASETS_FUSED_INTRA_AREA",
            fusion_report,
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "id": fused_id,
        "project_id": project_id,
        "name": ds_name,
        "version": version_tag,
        "input_shape": eda_result["input_shape"],
        "target": eda_result["target_column"],
        "metadata": eda_result,
        "splits": eda_result["splits"],
        "fusion_report": fusion_report,
        "created_at": now,
    }


@router.get("/datasets/{dataset_id}")
def get_dataset(
    dataset_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, project_id, name, version, input_shape, target, metadata_json, splits_json, created_at
            FROM datasets WHERE id = %s
            """,
            (dataset_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        verify_project_access(conn, row["project_id"], current_user)
        d = dict(row)
        d["metadata"] = json.loads(d["metadata_json"])
        d["splits"] = json.loads(d["splits_json"])
        del d["metadata_json"]
        del d["splits_json"]
        return d
    finally:
        conn.close()


@router.delete("/datasets/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, project_id, name, storage_key FROM datasets WHERE id = %s",
            (dataset_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")

        verify_project_access(conn, row["project_id"], current_user, allowed_roles=WRITE_PROJECT_ROLES)

        cursor.execute(
            "SELECT COUNT(*) FROM training_jobs WHERE dataset_id = %s AND status IN ('QUEUED', 'PREPARING', 'RUNNING', 'PAUSED')",
            (dataset_id,),
        )
        if cursor.fetchone()[0] > 0:
            raise HTTPException(
                status_code=409,
                detail="No se puede eliminar un dataset con entrenamientos activos en curso.",
            )

        storage_key = row["storage_key"]
        cursor.execute("SELECT COUNT(*) FROM datasets WHERE storage_key = %s AND id <> %s", (storage_key, dataset_id))
        other_refs = cursor.fetchone()[0]

        cursor.execute("DELETE FROM datasets WHERE id = %s", (dataset_id,))
        log_audit_event(
            conn,
            current_user["id"],
            current_user["display_name"],
            row["project_id"],
            "DATASET_DELETED",
            {"dataset_id": dataset_id, "name": row["name"]},
        )
        conn.commit()
    finally:
        conn.close()

    if storage_key and other_refs == 0:
        _cleanup_dataset_files(storage_key)

    return {"status": "deleted", "id": dataset_id}
