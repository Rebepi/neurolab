import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, MinMaxScaler

def perform_eda_and_preprocess(file_path: str, target_column: str = None, scaler_type: str = "standard"):
    df = pd.read_csv(file_path)
    total_rows, total_cols = df.shape

    if target_column is None or target_column not in df.columns:
        possible_targets = ["churn", "target", "label", "class", "default", "outcome", "status", "y"]
        found = False
        for pt in possible_targets:
            for col in df.columns:
                if col.lower() == pt:
                    target_column = col
                    found = True
                    break
            if found:
                break
        if not found:
            target_column = df.columns[-1]

    columns_summary = []
    missing_total = 0
    for col in df.columns:
        n_missing = int(df[col].isnull().sum())
        missing_total += n_missing
        dtype = "numeric" if pd.api.types.is_numeric_dtype(df[col]) else "categorical"
        summary = {
            "name": col,
            "dtype": dtype,
            "missing": n_missing,
            "unique": int(df[col].nunique()),
            "is_target": (col == target_column)
        }
        if dtype == "numeric":
            clean_s = df[col].dropna()
            summary["mean"] = float(clean_s.mean()) if len(clean_s) > 0 else 0.0
            summary["std"] = float(clean_s.std()) if len(clean_s) > 0 else 0.0
            summary["min"] = float(clean_s.min()) if len(clean_s) > 0 else 0.0
            summary["max"] = float(clean_s.max()) if len(clean_s) > 0 else 0.0
        else:
            top_vals = df[col].value_counts().head(5).to_dict()
            summary["top_values"] = {str(k): int(v) for k, v in top_vals.items()}
        columns_summary.append(summary)

    for col in df.columns:
        if df[col].isnull().sum() > 0:
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median())
            else:
                mode_val = df[col].mode()
                fill_val = mode_val[0] if len(mode_val) > 0 else "Unknown"
                df[col] = df[col].fillna(fill_val)

    y_raw = df[target_column]
    X_raw = df.drop(columns=[target_column])

    unique_targets = list(y_raw.unique())
    n_unique_y = len(unique_targets)

    if n_unique_y == 2:
        problem_type = "binary_classification"
        mapping = {unique_targets[0]: 0, unique_targets[1]: 1}
        if set(unique_targets).issubset({0, 1}):
            y_arr = y_raw.astype(float).values
        elif set(unique_targets).issubset({"0", "1"}):
            y_arr = y_raw.astype(float).values
        else:
            y_arr = y_raw.map(mapping).astype(float).values
        output_dim = 1
        output_activation = "sigmoid"
        suggested_loss = "binary_crossentropy"
        suggested_metric = "accuracy"
    elif n_unique_y > 2 and (not pd.api.types.is_numeric_dtype(y_raw) or n_unique_y <= 10):
        problem_type = "multiclass_classification"
        mapping = {val: idx for idx, val in enumerate(unique_targets)}
        y_arr = y_raw.map(mapping).values
        output_dim = n_unique_y
        output_activation = "softmax"
        suggested_loss = "sparse_categorical_crossentropy"
        suggested_metric = "accuracy"
    else:
        problem_type = "regression"
        y_arr = y_raw.astype(float).values
        output_dim = 1
        output_activation = "linear"
        suggested_loss = "mean_squared_error"
        suggested_metric = "mae"

    X_encoded = pd.get_dummies(X_raw, drop_first=True)
    feature_names = list(X_encoded.columns)
    input_shape = len(feature_names)

    if scaler_type == "minmax":
        scaler = MinMaxScaler()
    else:
        scaler = StandardScaler()

    X_scaled = scaler.fit_transform(X_encoded.values.astype(float))

    indices = np.arange(len(df))
    train_idx, temp_idx, y_train, y_temp = train_test_split(
        indices, y_arr, test_size=0.30, random_state=42
    )
    val_idx, test_idx, y_val, y_test = train_test_split(
        temp_idx, y_temp, test_size=0.50, random_state=42
    )

    X_train = X_scaled[train_idx]
    X_val = X_scaled[val_idx]
    X_test = X_scaled[test_idx]

    preview_rows = df.head(10).to_dict(orient="records")

    eda_result = {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "input_shape": input_shape,
        "output_dim": output_dim,
        "problem_type": problem_type,
        "target_column": target_column,
        "scaler_applied": scaler_type,
        "feature_names": feature_names,
        "output_activation": output_activation,
        "suggested_loss": suggested_loss,
        "suggested_metric": suggested_metric,
        "splits": {
            "train_count": len(train_idx),
            "val_count": len(val_idx),
            "test_count": len(test_idx),
            "train_ratio": 0.70,
            "val_ratio": 0.15,
            "test_ratio": 0.15
        },
        "columns_summary": columns_summary,
        "preview": preview_rows
    }

    base_dir = os.path.dirname(file_path)
    file_id = os.path.splitext(os.path.basename(file_path))[0]
    splits_file = os.path.join(base_dir, f"{file_id}_splits.npz")
    np.savez_compressed(
        splits_file,
        X_train=X_train,
        y_train=y_train,
        X_val=X_val,
        y_val=y_val,
        X_test=X_test,
        y_test=y_test
    )

    return eda_result, splits_file

