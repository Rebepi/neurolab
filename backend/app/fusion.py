import os
import json
import numpy as np
import pandas as pd
from app.eda import perform_eda_and_preprocess


def fuse_intra_area_datasets(
    dataset_records: list,
    output_csv_path: str,
    merge_strategy: str = "union",
    deduplicate: bool = True,
    scaler_type: str = "standard",
):
    if len(dataset_records) < 2:
        raise ValueError("Debes seleccionar al menos 2 datasets para ejecutar la fusión inteligente.")

    frames = []
    col_sets = []
    target_names = []
    problem_types = []
    total_input_rows = 0

    for rec in dataset_records:
        csv_path = rec.get("storage_key")
        if not csv_path or not os.path.exists(csv_path):
            raise FileNotFoundError(f"No se encontró el archivo CSV del dataset {rec.get('name')}")
        meta = json.loads(rec.get("metadata_json") or "{}")
        target_col = rec.get("target") or meta.get("target_column")
        prob_type = meta.get("problem_type")

        df = pd.read_csv(csv_path)
        if target_col not in df.columns:
            target_col = df.columns[-1]

        target_names.append(target_col)
        problem_types.append(prob_type)
        total_input_rows += len(df)
        frames.append((df, target_col, rec.get("name", "dataset")))
        col_sets.append(set(c for c in df.columns if c != target_col))

    unique_probs = set(p for p in problem_types if p)
    if len(unique_probs) > 1:
        raise ValueError(
            f"Los datasets tienen tipos de problema incompatibles ({', '.join(unique_probs)}). Para unir distintas temáticas usa 'Unir Áreas → Modelo General'."
        )

    canonical_target = target_names[0]
    intersection_cols = set.intersection(*col_sets)
    union_cols = set.union(*col_sets)
    jaccard_pct = round((len(intersection_cols) / max(1, len(union_cols))) * 100.0, 1)

    if merge_strategy == "intersection" and len(intersection_cols) == 0:
        raise ValueError("No existen columnas de entrada en común para una intersección estricta; usa la estrategia 'Unión Inteligente'.")

    selected_features = sorted(list(intersection_cols if merge_strategy == "intersection" else union_cols))

    aligned_frames = []
    for df, t_col, ds_name in frames:
        work = df.copy()
        if t_col != canonical_target:
            work[canonical_target] = work[t_col]
        keep_cols = [c for c in selected_features if c in work.columns] + [canonical_target]
        aligned_frames.append(work[keep_cols])

    merged_df = pd.concat(aligned_frames, ignore_index=True, sort=False)

    for col in selected_features:
        if col not in merged_df.columns:
            merged_df[col] = 0.0
        elif merged_df[col].isnull().sum() > 0:
            if pd.api.types.is_numeric_dtype(merged_df[col]):
                merged_df[col] = merged_df[col].fillna(merged_df[col].median())
            else:
                mode_v = merged_df[col].mode()
                merged_df[col] = merged_df[col].fillna(mode_v[0] if len(mode_v) > 0 else "Desconocido")

    merged_df = merged_df[selected_features + [canonical_target]]

    rows_before_dedup = len(merged_df)
    duplicates_removed = 0
    if deduplicate:
        merged_df = merged_df.drop_duplicates().reset_index(drop=True)
        duplicates_removed = rows_before_dedup - len(merged_df)

    os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)
    merged_df.to_csv(output_csv_path, index=False)

    eda_result, splits_file = perform_eda_and_preprocess(
        output_csv_path,
        target_column=canonical_target,
        scaler_type=scaler_type,
    )

    fusion_report = {
        "mode": "intra_area_fusion",
        "strategy": merge_strategy,
        "datasets_merged": len(dataset_records),
        "total_input_rows": total_input_rows,
        "final_rows": len(merged_df),
        "duplicates_removed": duplicates_removed,
        "jaccard_compatibility_pct": jaccard_pct,
        "aligned_feature_count": len(selected_features),
        "shared_columns_count": len(intersection_cols),
    }
    eda_result["fusion_report"] = fusion_report
    return eda_result, splits_file, fusion_report


def _compute_binary_alert(series: pd.Series, problem_type: str):
    if problem_type == "regression":
        vals = pd.to_numeric(series, errors="coerce").fillna(series.median())
        q25 = float(vals.quantile(0.25))
        return (vals <= q25).astype(int)
    if pd.api.types.is_numeric_dtype(series):
        vals = pd.to_numeric(series, errors="coerce").fillna(0)
        return (vals > 0).astype(int)
    s_lower = series.astype(str).str.strip().str.lower()
    healthy_tokens = {"operativo", "bajo", "normal", "estable", "no", "0", "legitimo", "saludable"}
    return (~s_lower.isin(healthy_tokens)).astype(int)


def fuse_cross_area_datasets(
    area_bundles: list,
    output_csv_path: str,
    max_rows_per_area: int = 5000,
    scaler_type: str = "standard",
):
    if len(area_bundles) < 2:
        raise ValueError("Debes seleccionar al menos 2 áreas corporativas para construir un Modelo General.")

    domain_frames = []
    area_contributions = []

    for bundle in area_bundles:
        csv_path = bundle["storage_key"]
        if not csv_path or not os.path.exists(csv_path):
            raise FileNotFoundError(f"CSV no encontrado para el área {bundle['project_name']}")

        df = pd.read_csv(csv_path)
        target_col = bundle["target"]
        meta = bundle["metadata"]
        prob_type = meta.get("problem_type", "binary_classification")
        area_code = bundle["area_code"]

        if len(df) > max_rows_per_area:
            df = df.sample(n=max_rows_per_area, random_state=42).reset_index(drop=True)

        alert_y = _compute_binary_alert(df[target_col], prob_type)
        X_raw = df.drop(columns=[target_col])

        num_cols = [c for c in X_raw.columns if pd.api.types.is_numeric_dtype(X_raw[c])]
        cat_cols = [c for c in X_raw.columns if not pd.api.types.is_numeric_dtype(X_raw[c]) and X_raw[c].nunique() <= 20]

        z_matrix = []
        norm_dict = {"area_corporativa": np.full(len(df), area_code, dtype=object)}

        for nc in num_cols:
            col_vals = pd.to_numeric(X_raw[nc], errors="coerce")
            col_vals = col_vals.fillna(col_vals.median() if not col_vals.dropna().empty else 0.0)
            mu = float(col_vals.mean())
            sd = float(col_vals.std()) or 1.0
            z_vals = ((col_vals - mu) / sd).clip(-4.0, 4.0)
            z_matrix.append(z_vals.values)
            norm_dict[f"{area_code}__{nc}"] = np.round(z_vals.values, 4)

        for cc in cat_cols:
            fill_c = X_raw[cc].mode()[0] if len(X_raw[cc].mode()) > 0 else "Otro"
            norm_dict[f"{area_code}__{cc}"] = X_raw[cc].fillna(fill_c).astype(str).values

        if len(z_matrix) > 0:
            z_stack = np.vstack(z_matrix)
            norm_dict["indice_magnitud_area"] = np.round(np.mean(z_stack, axis=0), 4)
            norm_dict["indice_volatilidad_area"] = np.round(np.std(z_stack, axis=0), 4)
            norm_dict["indice_pico_maximo_area"] = np.round(np.max(np.abs(z_stack), axis=0), 4)
        else:
            norm_dict["indice_magnitud_area"] = np.zeros(len(df))
            norm_dict["indice_volatilidad_area"] = np.zeros(len(df))
            norm_dict["indice_pico_maximo_area"] = np.zeros(len(df))

        norm_dict["alerta_corporativa"] = alert_y.values
        dom_df = pd.DataFrame(norm_dict)
        domain_frames.append(dom_df)

        area_contributions.append({
            "project_id": bundle["project_id"],
            "project_name": bundle["project_name"],
            "area_code": area_code,
            "rows_contributed": len(dom_df),
            "alert_rate_pct": round(float(alert_y.mean()) * 100.0, 1),
            "original_features": len(X_raw.columns),
        })

    unified_df = pd.concat(domain_frames, ignore_index=True, sort=False)

    for col in unified_df.columns:
        if col == "alerta_corporativa":
            continue
        if unified_df[col].isnull().any():
            if pd.api.types.is_numeric_dtype(unified_df[col]):
                unified_df[col] = unified_df[col].fillna(0.0)
            else:
                unified_df[col] = unified_df[col].fillna("No_Aplica")

    cols_ordered = [c for c in unified_df.columns if c != "alerta_corporativa"] + ["alerta_corporativa"]
    unified_df = unified_df[cols_ordered].sample(frac=1.0, random_state=42).reset_index(drop=True)

    os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)
    unified_df.to_csv(output_csv_path, index=False)

    eda_result, splits_file = perform_eda_and_preprocess(
        output_csv_path,
        target_column="alerta_corporativa",
        scaler_type=scaler_type,
    )

    fusion_report = {
        "mode": "cross_area_corporate_fusion",
        "areas_merged": len(area_bundles),
        "final_rows": len(unified_df),
        "unified_input_shape": eda_result["input_shape"],
        "target_column": "alerta_corporativa",
        "overall_alert_rate_pct": round(float(unified_df["alerta_corporativa"].mean()) * 100.0, 1),
        "area_contributions": area_contributions,
    }
    eda_result["fusion_report"] = fusion_report
    return eda_result, splits_file, fusion_report
