import os
import io
import re
import math
import warnings
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler

ALLOWED_MISSING_STRATEGIES = {"median_mode", "mean_mode", "drop_rows", "zero"}
ALLOWED_OUTLIER_STRATEGIES = {"none", "iqr_clip", "iqr_drop"}
ALLOWED_SCALERS = {"standard", "minmax", "robust", "none"}
SPLIT_RATIO_MAP = {
    "70/15/15": (0.70, 0.15, 0.15),
    "80/10/10": (0.80, 0.10, 0.10),
    "60/20/20": (0.60, 0.20, 0.20),
}
TARGET_CANDIDATES = [
    "fuga", "objetivo", "etiqueta", "clase", "morosidad", "fraude", "resultado", "estado",
    "estado_nodo", "valor_anual_usd", "churn", "target", "label", "class", "default",
    "outcome", "status", "y",
]
IDENTIFIER_TOKENS = {
    "id", "uuid", "guid", "codigo", "dni", "ruc", "email", "correo", "telefono", "celular",
    "cliente_id", "user_id", "id_cliente", "tx_id", "transaccion_id", "nro_documento", "documento",
}
CURRENCY_PATTERN = re.compile(r"(?i)(?:s/|usd|pen|eur|\$|€|%|,|\s)+")


def read_csv_flexible(file_path: str) -> pd.DataFrame:
    last_err = None
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            df = pd.read_csv(file_path, encoding=enc)
            df.columns = [str(c).strip() for c in df.columns]
            return df
        except UnicodeDecodeError as exc:
            last_err = exc
    if last_err:
        raise last_err
    return pd.read_csv(file_path)


def read_csv_bytes_flexible(raw_bytes: bytes) -> pd.DataFrame:
    last_err = None
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc)
            df.columns = [str(c).strip() for c in df.columns]
            return df
        except UnicodeDecodeError as exc:
            last_err = exc
    if last_err:
        raise last_err
    return pd.read_csv(io.BytesIO(raw_bytes))


def _resolve_target_column(df: pd.DataFrame, target_column: Optional[str] = None) -> str:
    if target_column and target_column in df.columns:
        return target_column
    for pt in TARGET_CANDIDATES:
        for col in df.columns:
            if col.lower() == pt:
                return col
    return df.columns[-1]


def sanitize_cell_value(val: Any) -> Any:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        f_val = float(val)
        if math.isnan(f_val) or math.isinf(f_val):
            return None
        return f_val
    return val


def sanitize_dataframe_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    records = df.to_dict(orient="records")
    return [{str(k): sanitize_cell_value(v) for k, v in rec.items()} for rec in records]


def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        f_val = float(val)
        return f_val if math.isfinite(f_val) else default
    except (TypeError, ValueError):
        return default


def _clean_numeric_string_series(series: pd.Series) -> Optional[pd.Series]:
    if pd.api.types.is_numeric_dtype(series):
        return None
    non_null = series.dropna().astype(str).str.strip()
    if len(non_null) < 3:
        return None
    has_sep_date = non_null.str.contains(r"^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}", regex=True).mean()
    if has_sep_date >= 0.5:
        return None
    has_dirty_hint = non_null.str.contains(r"(?i)(?:s/|usd|pen|eur|\$|€|%|\d,\d{3})", regex=True).any()
    stripped = non_null.str.replace(CURRENCY_PATTERN, "", regex=True).str.strip()
    numeric_vals = pd.to_numeric(stripped, errors="coerce")
    valid_ratio = float(numeric_vals.notna().mean())
    if valid_ratio < 0.75:
        return None
    if not has_dirty_hint and valid_ratio < 0.9:
        return None
    full_stripped = series.where(series.isna(), series.astype(str).str.replace(CURRENCY_PATTERN, "", regex=True).str.strip())
    return pd.to_numeric(full_stripped, errors="coerce")


def _normalize_categorical_series(series: pd.Series) -> Tuple[pd.Series, bool]:
    if pd.api.types.is_numeric_dtype(series):
        return series, False
    non_null_mask = series.notna()
    if int(non_null_mask.sum()) == 0:
        return series, False
    orig_vals = series[non_null_mask].astype(str)
    collapsed = orig_vals.str.replace(r"\s+", " ", regex=True).str.strip()
    lowered = collapsed.str.lower()
    canonical_map: Dict[str, str] = {}
    for key, group in collapsed.groupby(lowered):
        counts = group.value_counts()
        top_count = counts.iloc[0]
        tied = [str(v) for v, cnt in counts.items() if cnt == top_count]
        best = sorted(tied, key=lambda s: (not s[:1].isupper(), s))[0] if tied else str(key).title()
        canonical_map[str(key)] = best
    mapped = lowered.map(canonical_map)
    changed = bool((orig_vals != mapped).any())
    if not changed:
        return series, False
    out = series.copy()
    out.loc[non_null_mask] = mapped.values
    return out, True


def _detect_date_series(series: pd.Series) -> Optional[pd.Series]:
    if pd.api.types.is_numeric_dtype(series):
        return None
    non_null = series.dropna().astype(str).str.strip()
    if len(non_null) < 3:
        return None
    sep_ratio = float(non_null.str.contains(r"\d[-/]\d", regex=True).mean())
    if sep_ratio < 0.7:
        return None
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            parsed_sample = pd.to_datetime(non_null, errors="coerce", format="mixed")
        except TypeError:
            parsed_sample = pd.to_datetime(non_null, errors="coerce")
        if float(parsed_sample.notna().mean()) < 0.8:
            return None
        try:
            parsed_full = pd.to_datetime(series, errors="coerce", format="mixed")
        except TypeError:
            parsed_full = pd.to_datetime(series, errors="coerce")
    return parsed_full


def _compute_class_balance(y_raw: pd.Series, problem_type: str, target_classes: List[str]) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, float]]]:
    if problem_type == "regression":
        return None, None
    total = int(len(y_raw))
    if total == 0:
        return None, None
    counts = y_raw.astype(str).value_counts().to_dict()
    distribution: Dict[str, int] = {}
    for idx, cls_label in enumerate(target_classes):
        cnt = int(counts.get(str(cls_label), 0))
        if cnt == 0 and str(idx) in counts:
            cnt = int(counts[str(idx)])
        distribution[str(cls_label)] = cnt
    if sum(distribution.values()) == 0:
        distribution = {str(k): int(v) for k, v in counts.items()}
    min_count = min(distribution.values()) if distribution else total
    minority_pct = round((min_count / max(1, total)) * 100.0, 2)
    is_imbalanced = minority_pct < 15.0
    n_classes = max(1, len(distribution))
    weights: Optional[Dict[str, float]] = None
    if is_imbalanced and n_classes >= 2:
        weights = {}
        for idx, cls_label in enumerate(target_classes):
            cnt = max(1, int(distribution.get(str(cls_label), 1)))
            weights[str(idx)] = round(total / (n_classes * cnt), 4)
    return {
        "distribution": distribution,
        "minority_class_pct": minority_pct,
        "is_imbalanced": is_imbalanced,
    }, weights


def perform_eda_and_preprocess(
    file_path: str,
    target_column: Optional[str] = None,
    scaler_type: str = "standard",
    missing_strategy: str = "median_mode",
    drop_duplicates: bool = False,
    outlier_strategy: str = "none",
    drop_columns: Optional[List[str]] = None,
    split_ratio: str = "70/15/15",
    save_cleaned_path: Optional[str] = None,
    normalize_text: bool = False,
    extract_dates: bool = False,
    group_rare_categories: bool = False,
    log_transform_skewed: bool = False,
    stratify_split: bool = True,
):
    scaler_mode = (scaler_type or "standard").lower()
    if scaler_mode not in ALLOWED_SCALERS:
        scaler_mode = "standard"

    missing_mode = (missing_strategy or "median_mode").lower()
    if missing_mode not in ALLOWED_MISSING_STRATEGIES:
        missing_mode = "median_mode"

    outlier_mode = (outlier_strategy or "none").lower()
    if outlier_mode not in ALLOWED_OUTLIER_STRATEGIES:
        outlier_mode = "none"

    ratio_key = split_ratio if split_ratio in SPLIT_RATIO_MAP else "70/15/15"
    train_ratio, val_ratio, test_ratio = SPLIT_RATIO_MAP[ratio_key]

    df = read_csv_flexible(file_path)

    raw_stats = {
        "raw_rows": int(len(df)),
        "raw_columns": int(len(df.columns)),
        "raw_null_cells": int(df.isna().sum().sum()),
        "raw_null_rows": int(df.isna().any(axis=1).sum()),
        "raw_duplicate_rows": int(df.duplicated().sum()),
    }

    if len(df.columns) < 2:
        raise ValueError("El dataset debe contener al menos 2 columnas (variables + target).")

    if target_column is None or target_column not in df.columns:
        target_column = _resolve_target_column(df, target_column)

    requested_drops = [str(c).strip() for c in (drop_columns or []) if str(c).strip()]
    manual_dropped = [c for c in requested_drops if c in df.columns and c != target_column]
    if manual_dropped:
        df = df.drop(columns=manual_dropped)

    if len(df.columns) < 2:
        raise ValueError("Deben quedar al menos 1 variable predictora y 1 columna objetivo tras excluir columnas.")

    raw_missing_map = {str(col): int(df[col].isna().sum()) for col in df.columns}

    target_null_mask = df[target_column].isna()
    target_null_rows_removed = int(target_null_mask.sum())
    if target_null_rows_removed > 0:
        df = df[~target_null_mask].reset_index(drop=True)

    duplicates_removed = 0
    if drop_duplicates:
        duplicates_removed = int(df.duplicated().sum())
        if duplicates_removed > 0:
            df = df.drop_duplicates().reset_index(drop=True)

    dates_extracted: List[str] = []
    if extract_dates:
        for col in list(df.columns):
            if col == target_column:
                continue
            parsed_dt = _detect_date_series(df[col])
            if parsed_dt is not None:
                valid_dt = parsed_dt.dropna()
                if len(valid_dt) > 0:
                    fill_dt = valid_dt.sort_values().iloc[len(valid_dt) // 2]
                    filled_dt = parsed_dt.fillna(fill_dt)
                    df[f"{col}_mes"] = filled_dt.dt.month.astype(int)
                    df[f"{col}_dia_semana"] = filled_dt.dt.dayofweek.astype(int)
                    df[f"{col}_fin_semana"] = (filled_dt.dt.dayofweek >= 5).astype(int)
                    df = df.drop(columns=[col])
                    dates_extracted.append(col)
                    for new_c in (f"{col}_mes", f"{col}_dia_semana", f"{col}_fin_semana"):
                        raw_missing_map[new_c] = int(parsed_dt.isna().sum())

    numeric_repaired: List[str] = []
    text_normalized: List[str] = []
    if normalize_text:
        for col in list(df.columns):
            if col == target_column or pd.api.types.is_numeric_dtype(df[col]):
                continue
            converted = _clean_numeric_string_series(df[col])
            if converted is not None:
                df[col] = converted
                numeric_repaired.append(col)
            else:
                norm_s, did_change = _normalize_categorical_series(df[col])
                if did_change:
                    df[col] = norm_s
                    text_normalized.append(col)

    if missing_mode == "drop_rows":
        df = df.dropna().reset_index(drop=True)
    else:
        for col in df.columns:
            if col == target_column or df[col].isna().sum() == 0:
                continue
            if pd.api.types.is_numeric_dtype(df[col]):
                if missing_mode == "mean_mode":
                    fill_val = _safe_float(df[col].mean(), 0.0)
                elif missing_mode == "zero":
                    fill_val = 0.0
                else:
                    fill_val = _safe_float(df[col].median(), 0.0)
                df[col] = df[col].fillna(fill_val)
            else:
                if missing_mode == "zero":
                    fill_val = "Desconocido"
                else:
                    mode_val = df[col].mode()
                    fill_val = mode_val[0] if len(mode_val) > 0 else "Desconocido"
                df[col] = df[col].fillna(fill_val)

    if len(df) < 5:
        raise ValueError("El dataset resultante tras la limpieza tiene menos de 5 filas válidas.")

    outliers_handled = 0
    if outlier_mode != "none":
        numeric_feature_cols = [
            c for c in df.columns
            if c != target_column and pd.api.types.is_numeric_dtype(df[c])
        ]
        if outlier_mode == "iqr_clip":
            for col in numeric_feature_cols:
                q1 = df[col].quantile(0.25)
                q3 = df[col].quantile(0.75)
                iqr = q3 - q1
                if pd.notna(iqr) and float(iqr) > 0:
                    low = float(q1 - 1.5 * iqr)
                    high = float(q3 + 1.5 * iqr)
                    out_mask = (df[col] < low) | (df[col] > high)
                    outliers_handled += int(out_mask.sum())
                    df[col] = df[col].clip(lower=low, upper=high)
        elif outlier_mode == "iqr_drop":
            drop_mask = pd.Series(False, index=df.index)
            for col in numeric_feature_cols:
                q1 = df[col].quantile(0.25)
                q3 = df[col].quantile(0.75)
                iqr = q3 - q1
                if pd.notna(iqr) and float(iqr) > 0:
                    low = float(q1 - 1.5 * iqr)
                    high = float(q3 + 1.5 * iqr)
                    drop_mask = drop_mask | (df[col] < low) | (df[col] > high)
            outliers_handled = int(drop_mask.sum())
            if outliers_handled > 0:
                df = df[~drop_mask].reset_index(drop=True)

    if len(df) < 5:
        raise ValueError("El dataset resultante tras eliminar valores atípicos tiene menos de 5 filas válidas.")

    rare_grouped_columns: List[str] = []
    if group_rare_categories:
        for col in df.columns:
            if col == target_column or pd.api.types.is_numeric_dtype(df[col]):
                continue
            freqs = df[col].value_counts(normalize=True)
            if len(freqs) > 8:
                rare_vals = set(freqs[freqs < 0.01].index.tolist())
                if len(rare_vals) >= 2:
                    df[col] = df[col].where(~df[col].isin(rare_vals), "Otros")
                    rare_grouped_columns.append(col)

    if save_cleaned_path:
        os.makedirs(os.path.dirname(save_cleaned_path), exist_ok=True)
        df.to_csv(save_cleaned_path, index=False)

    total_rows, total_cols = df.shape

    columns_summary = []
    excluded_columns = []
    for col in df.columns:
        orig_missing = raw_missing_map.get(col, 0)
        after_missing = int(df[col].isna().sum())
        dtype = "numeric" if pd.api.types.is_numeric_dtype(df[col]) else "categorical"
        n_unique = int(df[col].nunique())
        is_target = (col == target_column)
        summary = {
            "name": col,
            "dtype": dtype,
            "missing": orig_missing,
            "missing_after": after_missing,
            "unique": n_unique,
            "is_target": is_target,
        }
        if dtype == "numeric":
            clean_s = df[col].dropna()
            summary["mean"] = _safe_float(clean_s.mean()) if len(clean_s) > 0 else 0.0
            summary["std"] = _safe_float(clean_s.std()) if len(clean_s) > 1 else 0.0
            summary["min"] = _safe_float(clean_s.min()) if len(clean_s) > 0 else 0.0
            summary["max"] = _safe_float(clean_s.max()) if len(clean_s) > 0 else 0.0
        else:
            top_vals = df[col].value_counts().head(12).to_dict()
            summary["top_values"] = {str(k): int(v) for k, v in top_vals.items()}
            if not is_target and n_unique > 50:
                excluded_columns.append(col)
                summary["excluded_reason"] = "high_cardinality_id"
        columns_summary.append(summary)

    y_raw = df[target_column]
    drop_cols = [target_column] + [c for c in excluded_columns if c in df.columns and c != target_column]
    X_raw = df.drop(columns=drop_cols)

    unique_targets = list(y_raw.unique())
    n_unique_y = len(unique_targets)
    if n_unique_y == 0:
        raise ValueError("La columna objetivo no contiene valores válidos.")

    if n_unique_y == 2:
        problem_type = "binary_classification"
        if set(unique_targets).issubset({0, 1}) or set(unique_targets).issubset({"0", "1"}):
            y_arr = y_raw.astype(float).values
            target_classes = ["0", "1"]
        else:
            sorted_t = sorted(unique_targets, key=lambda x: str(x))
            mapping = {sorted_t[0]: 0, sorted_t[1]: 1}
            y_arr = y_raw.map(mapping).astype(float).values
            target_classes = [str(sorted_t[0]), str(sorted_t[1])]
        output_dim = 1
        output_activation = "sigmoid"
        suggested_loss = "binary_crossentropy"
        suggested_metric = "accuracy"
    elif n_unique_y > 2 and (not pd.api.types.is_numeric_dtype(y_raw) or n_unique_y <= 15):
        problem_type = "multiclass_classification"
        sorted_t = sorted(unique_targets, key=lambda x: str(x))
        mapping = {val: idx for idx, val in enumerate(sorted_t)}
        y_arr = y_raw.map(mapping).values
        target_classes = [str(v) for v in sorted_t]
        output_dim = n_unique_y
        output_activation = "softmax"
        suggested_loss = "sparse_categorical_crossentropy"
        suggested_metric = "accuracy"
    else:
        problem_type = "regression"
        y_arr = y_raw.astype(float).values
        target_classes = [str(target_column)]
        output_dim = 1
        output_activation = "linear"
        suggested_loss = "mean_squared_error"
        suggested_metric = "mae"

    class_balance, recommended_class_weights = _compute_class_balance(y_raw, problem_type, target_classes)

    X_encoded = pd.get_dummies(X_raw, drop_first=True)
    feature_names = list(X_encoded.columns)
    input_shape = len(feature_names)
    if input_shape == 0:
        raise ValueError("No quedan variables de entrada válidas tras excluir columnas.")

    log_transformed_columns: List[str] = []
    if log_transform_skewed:
        for col in X_raw.columns:
            if col in X_encoded.columns and pd.api.types.is_numeric_dtype(X_raw[col]):
                s = pd.to_numeric(X_raw[col], errors="coerce").dropna()
                if len(s) >= 5 and float(s.min()) >= 0.0 and len(s.unique()) > 2:
                    if _safe_float(s.skew(), 0.0) >= 2.0:
                        X_encoded[col] = np.log1p(np.maximum(0.0, X_encoded[col].astype(float)))
                        log_transformed_columns.append(col)

    X_values = X_encoded.values.astype(float)
    if scaler_mode == "minmax":
        scaler = MinMaxScaler()
        X_scaled = scaler.fit_transform(X_values)
        scaler_params = {
            "type": "minmax",
            "min": [float(v) for v in scaler.data_min_],
            "scale": [float(v) for v in scaler.scale_],
        }
    elif scaler_mode == "robust":
        scaler = RobustScaler()
        X_scaled = scaler.fit_transform(X_values)
        scaler_params = {
            "type": "robust",
            "center": [float(v) for v in scaler.center_],
            "scale": [float(v) if v != 0 else 1.0 for v in scaler.scale_],
        }
    elif scaler_mode == "none":
        X_scaled = X_values
        scaler_params = None
    else:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_values)
        scaler_params = {
            "type": "standard",
            "mean": [float(v) for v in scaler.mean_],
            "scale": [float(v) if v != 0 else 1.0 for v in scaler.scale_],
        }

    indices = np.arange(len(df))
    temp_ratio = val_ratio + test_ratio
    stratified_applied = False
    can_stratify = False
    if stratify_split and problem_type != "regression" and len(df) >= 20:
        counts = pd.Series(y_arr).value_counts()
        if len(counts) >= 2 and int(counts.min()) >= 4:
            can_stratify = True

    if can_stratify:
        try:
            train_idx, temp_idx, y_train, y_temp = train_test_split(
                indices, y_arr, test_size=temp_ratio, random_state=42, stratify=y_arr
            )
            second_test_fraction = test_ratio / temp_ratio if temp_ratio > 0 else 0.5
            temp_counts = pd.Series(y_temp).value_counts()
            strat_temp = y_temp if (len(temp_counts) >= 2 and int(temp_counts.min()) >= 2) else None
            val_idx, test_idx, y_val, y_test = train_test_split(
                temp_idx, y_temp, test_size=second_test_fraction, random_state=42, stratify=strat_temp
            )
            stratified_applied = True
        except ValueError:
            can_stratify = False

    if not can_stratify:
        train_idx, temp_idx, y_train, y_temp = train_test_split(
            indices, y_arr, test_size=temp_ratio, random_state=42
        )
        second_test_fraction = test_ratio / temp_ratio if temp_ratio > 0 else 0.5
        val_idx, test_idx, y_val, y_test = train_test_split(
            temp_idx, y_temp, test_size=second_test_fraction, random_state=42
        )

    X_train = X_scaled[train_idx]
    X_val = X_scaled[val_idx]
    X_test = X_scaled[test_idx]

    preview_rows = sanitize_dataframe_records(df.head(10))

    cleaning_report = {
        "rows_before": raw_stats["raw_rows"],
        "rows_after": int(len(df)),
        "rows_removed": int(raw_stats["raw_rows"] - len(df)),
        "target_null_rows_removed": target_null_rows_removed,
        "null_cells_before": raw_stats["raw_null_cells"],
        "null_cells_after": int(df.isna().sum().sum()),
        "duplicates_removed": duplicates_removed,
        "outliers_handled": outliers_handled,
        "columns_dropped": manual_dropped,
        "missing_strategy": missing_mode,
        "outlier_strategy": outlier_mode,
        "scaler_applied": scaler_mode,
        "split_ratio": ratio_key,
        "numeric_repaired": numeric_repaired,
        "text_normalized": text_normalized,
        "dates_extracted": dates_extracted,
        "rare_grouped_columns": rare_grouped_columns,
        "log_transformed_columns": log_transformed_columns,
        "stratified_applied": stratified_applied,
        "normalize_text": normalize_text,
        "extract_dates": extract_dates,
        "group_rare_categories": group_rare_categories,
        "log_transform_skewed": log_transform_skewed,
    }

    eda_result = {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "input_shape": input_shape,
        "output_dim": output_dim,
        "problem_type": problem_type,
        "target_column": target_column,
        "target_classes": target_classes,
        "excluded_columns": excluded_columns,
        "scaler_applied": scaler_mode,
        "scaler_params": scaler_params,
        "log_transformed_columns": log_transformed_columns,
        "feature_names": feature_names,
        "output_activation": output_activation,
        "suggested_loss": suggested_loss,
        "suggested_metric": suggested_metric,
        "class_balance": class_balance,
        "recommended_class_weights": recommended_class_weights,
        "splits": {
            "train_count": len(train_idx),
            "val_count": len(val_idx),
            "test_count": len(test_idx),
            "train_ratio": train_ratio,
            "val_ratio": val_ratio,
            "test_ratio": test_ratio,
        },
        "columns_summary": columns_summary,
        "preview": preview_rows,
        "raw_stats": raw_stats,
        "cleaning_report": cleaning_report,
    }

    target_csv_for_splits = save_cleaned_path if save_cleaned_path else file_path
    base_dir = os.path.dirname(target_csv_for_splits)
    file_id = os.path.splitext(os.path.basename(target_csv_for_splits))[0]
    splits_file = os.path.join(base_dir, f"{file_id}_splits.npz")
    np.savez_compressed(
        splits_file,
        X_train=X_train,
        y_train=y_train,
        X_val=X_val,
        y_val=y_val,
        X_test=X_test,
        y_test=y_test,
    )

    return eda_result, splits_file


def analyze_dataset_for_auto_clean(df: pd.DataFrame, target_column: Optional[str] = None) -> Dict[str, Any]:
    if len(df.columns) < 2:
        raise ValueError("El dataset debe contener al menos 2 columnas para diagnosticarse.")
    if len(df) < 5:
        raise ValueError("El dataset debe contener al menos 5 filas para diagnosticarse.")

    target_col = _resolve_target_column(df, target_column)
    predictor_cols = [c for c in df.columns if c != target_col]

    sim_df = df.copy()
    dirty_numeric_columns: List[str] = []
    inconsistent_text_columns: List[str] = []
    date_columns: List[str] = []
    rare_category_columns: List[str] = []

    for col in predictor_cols:
        if pd.api.types.is_numeric_dtype(sim_df[col]):
            continue
        parsed_dt = _detect_date_series(sim_df[col])
        if parsed_dt is not None:
            date_columns.append(col)
            continue
        repaired_num = _clean_numeric_string_series(sim_df[col])
        if repaired_num is not None:
            sim_df[col] = repaired_num
            dirty_numeric_columns.append(col)
            continue
        norm_s, changed = _normalize_categorical_series(sim_df[col])
        if changed:
            sim_df[col] = norm_s
            inconsistent_text_columns.append(col)

    normalize_text = len(dirty_numeric_columns) > 0 or len(inconsistent_text_columns) > 0
    extract_dates = len(date_columns) > 0

    dropped_details: List[Dict[str, str]] = []
    drop_columns: List[str] = []
    critical_alerts: List[Dict[str, str]] = []
    col_missing_map: Dict[str, float] = {}

    if dirty_numeric_columns:
        critical_alerts.append({
            "type": "dirty_format",
            "severity": "warning",
            "title": "Formatos numéricos almacenados como texto",
            "detail": "Se detectaron símbolos de moneda, porcentajes o comas en: " + ", ".join(dirty_numeric_columns) + ".",
        })

    for col in predictor_cols:
        if col in date_columns:
            col_missing_map[col] = float(sim_df[col].isna().mean())
            continue
        missing_pct = float(sim_df[col].isna().mean())
        col_missing_map[col] = missing_pct
        non_null = sim_df[col].dropna()
        n_unique = int(non_null.nunique())
        unique_ratio = n_unique / max(1, len(non_null))
        norm_name = col.strip().lower()
        is_id_name = (
            norm_name in IDENTIFIER_TOKENS
            or norm_name.startswith("id_")
            or norm_name.endswith("_id")
        )
        is_numeric = pd.api.types.is_numeric_dtype(sim_df[col])

        if n_unique <= 1:
            drop_columns.append(col)
            dropped_details.append({
                "column": col,
                "reason": "Columna constante sin varianza (no aporta señal predictiva)",
            })
        elif missing_pct >= 0.45:
            drop_columns.append(col)
            dropped_details.append({
                "column": col,
                "reason": f"Exceso de valores nulos ({round(missing_pct * 100, 1)}%)",
            })
        elif (not is_numeric and n_unique > 50 and unique_ratio >= 0.85) or (
            is_id_name and unique_ratio >= 0.85 and n_unique > 20
        ):
            drop_columns.append(col)
            dropped_details.append({
                "column": col,
                "reason": f"Identificador único / alta cardinalidad ({n_unique} valores únicos)",
            })

    y_sim_series = sim_df[target_col]
    if pd.api.types.is_numeric_dtype(y_sim_series):
        y_num_sim = pd.to_numeric(y_sim_series, errors="coerce")
    else:
        y_num_sim = pd.Series(pd.factorize(y_sim_series)[0], index=sim_df.index, dtype=float)
        y_num_sim = y_num_sim.where(y_sim_series.notna(), np.nan)

    active_num_candidates = [
        c for c in predictor_cols
        if c not in drop_columns and c not in date_columns and pd.api.types.is_numeric_dtype(sim_df[c])
    ]

    leakage_cols: List[str] = []
    for col in active_num_candidates:
        pair = pd.concat([pd.to_numeric(sim_df[col], errors="coerce"), y_num_sim], axis=1).dropna()
        if len(pair) >= 10 and float(pair.iloc[:, 0].std()) > 0 and float(pair.iloc[:, 1].std()) > 0:
            corr = abs(_safe_float(pair.iloc[:, 0].corr(pair.iloc[:, 1]), 0.0))
            if corr >= 0.98:
                leakage_cols.append(col)
                drop_columns.append(col)
                dropped_details.append({
                    "column": col,
                    "reason": f"Fuga de datos (Target Leakage · |r|={corr:.3f} con {target_col})",
                })
    if leakage_cols:
        critical_alerts.append({
            "type": "target_leakage",
            "severity": "critical",
            "title": "Fuga de datos detectada (Target Leakage)",
            "detail": f"Columna(s) con correlación >= 0.98 respecto al objetivo ({', '.join(leakage_cols)}). Excluirlas evita modelos engañosos.",
        })

    remaining_num = [c for c in active_num_candidates if c not in drop_columns]
    collinear_pairs: List[str] = []
    if len(remaining_num) >= 2:
        corr_matrix = sim_df[remaining_num].apply(pd.to_numeric, errors="coerce").corr().abs()
        kept_corr: List[str] = []
        for col in remaining_num:
            redundant_with = None
            for kept in kept_corr:
                c_val = _safe_float(corr_matrix.loc[kept, col], 0.0)
                if c_val >= 0.95:
                    redundant_with = (kept, c_val)
                    break
            if redundant_with is not None:
                drop_columns.append(col)
                dropped_details.append({
                    "column": col,
                    "reason": f"Multicolinealidad redundante (|r|={redundant_with[1]:.3f} con {redundant_with[0]})",
                })
                collinear_pairs.append(f"{col} ↔ {redundant_with[0]}")
            else:
                kept_corr.append(col)
    if collinear_pairs:
        critical_alerts.append({
            "type": "multicollinearity",
            "severity": "warning",
            "title": "Variables redundantes (Multicolinealidad >= 0.95)",
            "detail": "Pares altamente colineales depurados: " + ", ".join(collinear_pairs) + ".",
        })

    if len(drop_columns) >= len(predictor_cols):
        best_keep = min(predictor_cols, key=lambda c: col_missing_map.get(c, 1.0))
        drop_columns = [c for c in drop_columns if c != best_keep]
        dropped_details = [d for d in dropped_details if d["column"] != best_keep]

    work_cols = [c for c in sim_df.columns if c not in drop_columns]
    work_df = sim_df[work_cols].copy()

    total_rows = int(len(work_df))
    target_null_rows = int(work_df[target_col].isna().sum())
    dup_rows = int(work_df.duplicated().sum())
    dup_pct = dup_rows / max(1, total_rows)
    drop_duplicates = dup_rows > 0

    feature_cols = [c for c in work_cols if c != target_col and c not in date_columns]
    feature_df = work_df[feature_cols] if feature_cols else work_df.iloc[:, 0:0]
    null_cells = int(work_df.isna().sum().sum())
    null_rows = int(work_df.isna().any(axis=1).sum())
    null_rows_pct = null_rows / max(1, total_rows)

    outlier_row_mask = pd.Series(False, index=work_df.index)
    extreme_row_mask = pd.Series(False, index=work_df.index)
    numeric_skews: List[float] = []
    null_numeric_skews: List[float] = []
    highly_skewed_positive_cols: List[str] = []
    all_unit_range = True
    has_continuous_numeric = False

    for col in feature_cols:
        if pd.api.types.is_numeric_dtype(work_df[col]):
            num_s = pd.to_numeric(work_df[col], errors="coerce").dropna()
            if len(num_s) < 3:
                continue
            uniq_vals = set(float(v) for v in num_s.unique()[:5])
            is_binary = len(num_s.unique()) <= 2 and uniq_vals.issubset({0.0, 1.0})
            if is_binary:
                continue

            has_continuous_numeric = True
            col_min = float(num_s.min())
            col_max = float(num_s.max())
            if col_min < 0.0 or col_max > 1.0:
                all_unit_range = False

            skew_signed = _safe_float(num_s.skew(), 0.0)
            skew_val = abs(skew_signed)
            numeric_skews.append(skew_val)
            if col_min >= 0.0 and skew_signed >= 2.0 and len(num_s.unique()) > 4:
                highly_skewed_positive_cols.append(col)
            if work_df[col].isna().sum() > 0:
                null_numeric_skews.append(skew_val)

            q1 = float(num_s.quantile(0.25))
            q3 = float(num_s.quantile(0.75))
            iqr = q3 - q1
            if math.isfinite(iqr) and iqr > 0:
                low_mod = q1 - 1.5 * iqr
                high_mod = q3 + 1.5 * iqr
                low_ext = q1 - 3.0 * iqr
                high_ext = q3 + 3.0 * iqr
                col_num = pd.to_numeric(work_df[col], errors="coerce")
                outlier_row_mask = outlier_row_mask | (col_num < low_mod) | (col_num > high_mod)
                extreme_row_mask = extreme_row_mask | (col_num < low_ext) | (col_num > high_ext)
        else:
            freqs = work_df[col].dropna().value_counts(normalize=True)
            if len(freqs) > 8 and int((freqs < 0.01).sum()) >= 2:
                rare_category_columns.append(col)

    group_rare_categories = len(rare_category_columns) > 0
    log_transform_skewed = len(highly_skewed_positive_cols) > 0

    outlier_rows = int(outlier_row_mask.sum())
    extreme_rows = int(extreme_row_mask.sum())
    outlier_row_pct = outlier_rows / max(1, total_rows)
    max_skew = max(numeric_skews) if numeric_skews else 0.0
    max_null_skew = max(null_numeric_skews) if null_numeric_skews else 0.0

    if outlier_rows == 0 or outlier_row_pct < 0.005:
        outlier_strategy = "none"
        outlier_reason = "No se detectaron valores atípicos relevantes (< 0.5% de registros)."
    elif outlier_row_pct <= 0.025 and extreme_rows > 0 and total_rows >= 200:
        outlier_strategy = "iqr_drop"
        outlier_reason = (
            f"Solo {outlier_rows} filas ({round(outlier_row_pct * 100, 2)}%) presentan anomalías extremas; "
            "eliminarlas depura la frontera de decisión sin pérdida significativa."
        )
    else:
        outlier_strategy = "iqr_clip"
        outlier_reason = (
            f"Se detectaron {outlier_rows} filas ({round(outlier_row_pct * 100, 1)}%) con valores fuera de rango IQR; "
            "recortar (Winsorize) estabiliza los gradientes sin descartar registros."
        )

    feature_null_rows = int(feature_df.isna().any(axis=1).sum()) if len(feature_cols) > 0 else 0
    if null_rows == 0:
        missing_strategy = "median_mode"
        missing_reason = "Dataset completo sin valores nulos; se mantiene imputación preventiva Mediana/Moda."
    elif null_rows_pct <= 0.03 and total_rows >= 200:
        missing_strategy = "drop_rows"
        missing_reason = (
            f"Solo el {round(null_rows_pct * 100, 2)}% de filas ({null_rows}) contienen nulos; "
            "eliminarlas preserva datos 100% reales sin sesgo de imputación."
        )
    elif max_null_skew >= 1.0 or outlier_row_pct > 0.02:
        missing_strategy = "median_mode"
        missing_reason = (
            f"{null_rows} filas ({round(null_rows_pct * 100, 1)}%) con nulos y distribuciones asimétricas/outliers; "
            "Mediana/Moda resiste valores extremos."
        )
    else:
        missing_strategy = "mean_mode"
        missing_reason = (
            f"{null_rows} filas ({round(null_rows_pct * 100, 1)}%) con nulos en distribuciones simétricas; "
            "Media/Moda conserva el centro estadístico."
        )

    if dup_rows > 0:
        dup_reason = (
            f"Se detectaron {dup_rows} filas duplicadas exactas ({round(dup_pct * 100, 1)}%); "
            "eliminarlas evita fuga de información entre Train y Test."
        )
    else:
        dup_reason = "No se detectaron filas duplicadas exactas."

    if has_continuous_numeric and all_unit_range:
        scaler_type = "none"
        scaler_reason = "Las variables numéricas ya están acotadas en el rango [0, 1]."
    elif has_continuous_numeric and (outlier_row_pct >= 0.03 or max_skew >= 1.5) and outlier_strategy != "iqr_drop":
        scaler_type = "robust"
        scaler_reason = "Presencia de outliers o asimetría marcada; RobustScaler (mediana e IQR) evita distorsión por extremos."
    elif has_continuous_numeric and outlier_row_pct < 0.01 and max_skew < 0.8 and outlier_strategy != "iqr_clip":
        scaler_type = "minmax"
        scaler_reason = "Distribuciones simétricas y acotadas sin extremos severos; Min-Max [0, 1] preserva proporciones."
    else:
        scaler_type = "standard"
        scaler_reason = "Variables con escalas heterogéneas; StandardScaler (Z-score) acelera la convergencia neuronal."

    y_clean_sim = work_df[target_col].dropna()
    n_unique_y = int(y_clean_sim.nunique())
    if n_unique_y == 2:
        p_type_sim = "binary_classification"
        t_classes_sim = [str(v) for v in sorted(y_clean_sim.unique(), key=lambda x: str(x))]
    elif n_unique_y > 2 and (not pd.api.types.is_numeric_dtype(y_clean_sim) or n_unique_y <= 15):
        p_type_sim = "multiclass_classification"
        t_classes_sim = [str(v) for v in sorted(y_clean_sim.unique(), key=lambda x: str(x))]
    else:
        p_type_sim = "regression"
        t_classes_sim = [str(target_col)]

    class_balance_info, _ = _compute_class_balance(y_clean_sim, p_type_sim, t_classes_sim)
    stratify_split = p_type_sim != "regression"
    if class_balance_info and class_balance_info["is_imbalanced"]:
        critical_alerts.append({
            "type": "class_imbalance",
            "severity": "warning",
            "title": f"Desbalanceo severo de clases ({class_balance_info['minority_class_pct']}% minoritaria)",
            "detail": "Se activará partición estratificada y pesos de clase automáticos (class_weight) durante el entrenamiento Keras.",
        })

    est_rows = total_rows - target_null_rows
    if drop_duplicates:
        est_rows -= dup_rows
    if missing_strategy == "drop_rows":
        est_rows -= feature_null_rows
    if outlier_strategy == "iqr_drop":
        est_rows -= outlier_rows
    est_rows = max(5, est_rows)

    if est_rows < 500:
        split_ratio = "60/20/20"
        split_reason = f"Volumen acotado (~{est_rows} filas limpias); 60/20/20 asegura muestras suficientes en validación y test."
    elif est_rows >= 5000:
        split_ratio = "80/10/10"
        split_reason = f"Alto volumen (~{est_rows:,} filas limpias); 80/10/10 maximiza datos de entrenamiento manteniendo test representativo."
    else:
        split_ratio = "70/15/15"
        split_reason = f"Volumen equilibrado (~{est_rows:,} filas limpias); partición estándar 70/15/15."

    if stratify_split:
        split_reason += " Con estratificación para mantener proporciones de clase."

    est_cols_count = len([c for c in work_cols if c != target_col]) - len(date_columns) + (len(date_columns) * 3) + 1
    est_input_shape = len(date_columns) * 3
    for col in feature_cols:
        if pd.api.types.is_numeric_dtype(work_df[col]):
            est_input_shape += 1
        else:
            freqs = work_df[col].dropna().value_counts(normalize=True)
            if group_rare_categories and col in rare_category_columns:
                n_kept = int((freqs >= 0.01).sum()) + 1
                est_input_shape += max(1, min(n_kept - 1, 50))
            elif len(freqs) <= 50:
                est_input_shape += max(1, len(freqs) - 1)
    est_input_shape = max(1, est_input_shape)

    if len(drop_columns) > 0:
        cols_reason = (
            f"Se excluyen {len(drop_columns)} columna(s) por ruido, fuga o redundancia: "
            + ", ".join(drop_columns)
            + "."
        )
    else:
        cols_reason = "Todas las columnas predictoras presentan varianza y señal saludables."

    format_parts: List[str] = []
    if dirty_numeric_columns:
        format_parts.append(f"reparar formato numérico en {', '.join(dirty_numeric_columns)}")
    if inconsistent_text_columns:
        format_parts.append(f"normalizar texto en {', '.join(inconsistent_text_columns)}")
    if date_columns:
        format_parts.append(f"extraer mes/día/fin de semana de {', '.join(date_columns)}")
    if rare_category_columns:
        format_parts.append(f"agrupar categorías raras (<1%) en {', '.join(rare_category_columns)}")
    if highly_skewed_positive_cols:
        format_parts.append(f"corregir sesgo log1p en {', '.join(highly_skewed_positive_cols)}")
    format_reason = (
        "Se recomienda " + "; ".join(format_parts) + "."
        if format_parts
        else "No se detectaron fechas, monedas en texto, ni categorías raras que requieran transformación."
    )

    raw_null_cells_all = int(df.isna().sum().sum())
    raw_null_cell_pct_all = raw_null_cells_all / max(1, len(df) * max(1, len(df.columns)))
    raw_dup_pct_all = float(df.duplicated().sum()) / max(1, len(df))
    penalty = (
        raw_null_cell_pct_all * 120.0
        + raw_dup_pct_all * 60.0
        + min(0.25, outlier_row_pct) * 60.0
        + len(drop_columns) * 5.0
        + len(dirty_numeric_columns) * 5.0
        + len(leakage_cols) * 10.0
    )
    health_score_before = max(20, min(100, int(round(100.0 - penalty))))
    health_score_after = min(100, max(health_score_before, 97 if est_rows >= 20 else 92))

    missing_labels = {
        "median_mode": "Imputar Mediana / Moda",
        "mean_mode": "Imputar Media / Moda",
        "drop_rows": "Eliminar filas con nulos",
        "zero": "Rellenar con 0 / Desconocido",
    }
    outlier_labels = {
        "none": "Conservar sin alterar",
        "iqr_clip": "Recortar rango IQR (Winsorize)",
        "iqr_drop": "Eliminar filas atípicas (IQR)",
    }
    scaler_labels = {
        "standard": "Standard (Z-score)",
        "minmax": "Min-Max [0, 1]",
        "robust": "Robust (Mediana / IQR)",
        "none": "Sin escalado",
    }

    return {
        "recommended": {
            "target_column": target_col,
            "missing_strategy": missing_strategy,
            "drop_duplicates": drop_duplicates,
            "outlier_strategy": outlier_strategy,
            "drop_columns": drop_columns,
            "scaler_type": scaler_type,
            "split_ratio": split_ratio,
            "normalize_text": normalize_text,
            "extract_dates": extract_dates,
            "group_rare_categories": group_rare_categories,
            "log_transform_skewed": log_transform_skewed,
            "stratify_split": stratify_split,
        },
        "diagnostics": {
            "total_rows": int(len(df)),
            "total_columns": int(len(df.columns)),
            "estimated_rows_after": int(est_rows),
            "null_cells": int(raw_null_cells_all),
            "null_rows": int(df.isna().any(axis=1).sum()),
            "null_rows_pct": round(float(df.isna().any(axis=1).mean()) * 100.0, 2),
            "duplicate_rows": int(dup_rows),
            "duplicate_rows_pct": round(dup_pct * 100.0, 2),
            "outlier_rows": int(outlier_rows),
            "outlier_rows_pct": round(outlier_row_pct * 100.0, 2),
            "health_score_before": health_score_before,
            "health_score_after": health_score_after,
            "dropped_columns_detail": dropped_details,
            "critical_alerts": critical_alerts,
            "class_balance": class_balance_info,
            "impact_preview": {
                "rows_before": int(len(df)),
                "estimated_rows_after": int(est_rows),
                "columns_before": int(len(df.columns)),
                "estimated_columns_after": int(max(2, est_cols_count)),
                "estimated_input_shape": int(est_input_shape),
            },
        },
        "explanations": [
            {
                "step": "Selección y Fuga de Datos",
                "decision": f"Excluir {len(drop_columns)}" if drop_columns else "Conservar todas",
                "reason": cols_reason,
            },
            {
                "step": "Formato, Fechas y Sesgo",
                "decision": "Auto-Ingeniería Activa" if format_parts else "Formato limpio",
                "reason": format_reason,
            },
            {
                "step": "Duplicados",
                "decision": "Eliminar duplicados" if drop_duplicates else "Sin duplicados",
                "reason": dup_reason,
            },
            {
                "step": "Valores Nulos",
                "decision": missing_labels[missing_strategy],
                "reason": missing_reason,
            },
            {
                "step": "Valores Atípicos (IQR)",
                "decision": outlier_labels[outlier_strategy],
                "reason": outlier_reason,
            },
            {
                "step": "Escalado y Partición",
                "decision": f"{scaler_labels[scaler_type]} · {split_ratio}",
                "reason": f"{scaler_reason} {split_reason}",
            },
        ],
    }
