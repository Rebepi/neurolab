import os
import sys
import json
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import get_db
from app.trainer import build_keras_model


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _login(client: TestClient, email: str, password: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_health_postgresql(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["services"]["database"] == "postgresql_ready"


def test_auth_jwt_and_me(client: TestClient):
    unauth = client.get("/api/v1/projects")
    assert unauth.status_code == 401

    bad = client.post("/api/v1/auth/login", json={"email": "admin@neurolab.io", "password": "wrong"})
    assert bad.status_code == 401

    token = _login(client, "admin@neurolab.io", "admin123")
    me = client.get("/api/v1/auth/me", headers=_auth_headers(token))
    assert me.status_code == 200
    assert me.json()["email"] == "admin@neurolab.io"
    assert me.json()["role"] == "Administrador"


def test_rbac_and_horizontal_isolation(client: TestClient):
    viewer_tok = _login(client, "viewer@neurolab.io", "view123")
    admin_tok = _login(client, "admin@neurolab.io", "admin123")
    eng_tok = _login(client, "engineer@neurolab.io", "eng123")

    admin_users = client.get("/api/v1/admin/users", headers=_auth_headers(viewer_tok))
    assert admin_users.status_code == 403

    read_proj = client.get("/api/v1/projects/prj-area-retencion", headers=_auth_headers(viewer_tok))
    assert read_proj.status_code == 200

    viewer_arch = client.post(
        "/api/v1/projects/prj-area-retencion/architectures",
        headers=_auth_headers(viewer_tok),
        json={
            "name": "No permitido",
            "family": "Feedforward",
            "input_shape": 10,
            "output_dim": 1,
            "output_activation": "sigmoid",
            "layers": [{"type": "Dense", "units": 16, "activation": "relu"}],
        },
    )
    assert viewer_arch.status_code == 403

    created = client.post(
        "/api/v1/projects",
        headers=_auth_headers(admin_tok),
        json={
            "name": "Proyecto Privado Test",
            "description": "Aislamiento RBAC",
            "owner_id": "usr-admin",
            "tags": ["Test"],
        },
    )
    assert created.status_code == 200
    pid = created.json()["id"]

    try:
        horiz = client.get(f"/api/v1/projects/{pid}", headers=_auth_headers(eng_tok))
        assert horiz.status_code == 403

        horiz_arch = client.post(
            f"/api/v1/projects/{pid}/architectures",
            headers=_auth_headers(eng_tok),
            json={
                "name": "Intruso",
                "family": "Feedforward",
                "input_shape": 8,
                "output_dim": 1,
                "output_activation": "sigmoid",
                "layers": [{"type": "Dense", "units": 16, "activation": "relu"}],
            },
        )
        assert horiz_arch.status_code == 403
    finally:
        client.delete(f"/api/v1/projects/{pid}", headers=_auth_headers(admin_tok))


def test_architectures_and_keras_families(client: TestClient):
    eng_tok = _login(client, "engineer@neurolab.io", "eng123")
    created_ids = []

    try:
        bad = client.post(
            "/api/v1/projects/prj-area-retencion/architectures",
            headers=_auth_headers(eng_tok),
            json={
                "name": "Invalid Layer Family",
                "family": "Feedforward",
                "input_shape": 20,
                "output_dim": 1,
                "output_activation": "sigmoid",
                "layers": [{"type": "Conv1D", "filters": 16, "kernel_size": 3}],
            },
        )
        assert bad.status_code == 400

        cnn_res = client.post(
            "/api/v1/projects/prj-area-retencion/architectures",
            headers=_auth_headers(eng_tok),
            json={
                "name": "Test CNN 1D",
                "family": "CNN",
                "input_shape": 20,
                "output_dim": 1,
                "output_activation": "sigmoid",
                "layers": [
                    {"type": "Conv1D", "filters": 16, "kernel_size": 3, "padding": "same", "activation": "relu"},
                    {"type": "MaxPooling1D", "pool_size": 2},
                    {"type": "Flatten"},
                    {"type": "Dense", "units": 16, "activation": "relu"},
                ],
            },
        )
        assert cnn_res.status_code == 200, cnn_res.text
        cnn_data = cnn_res.json()
        created_ids.append(cnn_data["id"])
        assert cnn_data["total_parameters"] > 0

        rnn_res = client.post(
            "/api/v1/projects/prj-area-retencion/architectures",
            headers=_auth_headers(eng_tok),
            json={
                "name": "Test RNN LSTM",
                "family": "RNN",
                "input_shape": 20,
                "output_dim": 1,
                "output_activation": "sigmoid",
                "layers": [
                    {"type": "LSTM", "units": 16, "activation": "tanh"},
                    {"type": "Dense", "units": 8, "activation": "relu"},
                ],
            },
        )
        assert rnn_res.status_code == 200, rnn_res.text
        rnn_data = rnn_res.json()
        created_ids.append(rnn_data["id"])
        assert rnn_data["total_parameters"] > 0

        for fam, cfg in [
            ("CNN", cnn_data["config"]),
            ("RNN", rnn_data["config"]),
            ("GAN", {"family": "GAN", "layers": [{"type": "Dense", "units": 16, "activation": "relu"}]}),
            ("Feedforward", {"family": "Feedforward", "layers": [{"type": "Dense", "units": 16, "activation": "relu"}]}),
        ]:
            model = build_keras_model(cfg, input_shape=20, output_dim=1, output_activation="sigmoid", family=fam)
            assert model.count_params() > 0
    finally:
        if created_ids:
            conn = get_db()
            try:
                cur = conn.cursor()
                cur.execute("DELETE FROM architectures WHERE id = ANY(%s)", (created_ids,))
                conn.commit()
            finally:
                conn.close()


def test_quotas_and_job_notes(client: TestClient):
    eng_tok = _login(client, "engineer@neurolab.io", "eng123")
    quotas = client.get("/api/v1/admin/system/quotas", headers=_auth_headers(eng_tok)).json()
    max_ep = int(quotas["max_epochs_per_job"])

    ds_list = client.get("/api/v1/projects/prj-area-retencion/datasets", headers=_auth_headers(eng_tok)).json()
    arch_list = client.get("/api/v1/projects/prj-area-retencion/architectures", headers=_auth_headers(eng_tok)).json()
    assert len(ds_list) > 0 and len(arch_list) > 0

    over_quota = client.post(
        "/api/v1/projects/prj-area-retencion/training-jobs",
        headers=_auth_headers(eng_tok),
        json={
            "architecture_id": arch_list[0]["id"],
            "dataset_id": ds_list[0]["id"],
            "hyperparams": {
                "epochs": max_ep + 25,
                "batch_size": 32,
                "optimizer": "adam",
                "learning_rate": 0.001,
            },
        },
    )
    assert over_quota.status_code == 400

    jobs = client.get("/api/v1/projects/prj-area-retencion/training-jobs", headers=_auth_headers(eng_tok)).json()
    if len(jobs) > 0:
        jid = jobs[0]["id"]
        prev_notes = jobs[0].get("notes") or ""
        try:
            res_notes = client.put(
                f"/api/v1/training-jobs/{jid}/notes",
                headers=_auth_headers(eng_tok),
                json={"notes": "Observación verificada en test automatizado"},
            )
            assert res_notes.status_code == 200
            assert res_notes.json()["notes"] == "Observación verificada en test automatizado"
        finally:
            client.put(
                f"/api/v1/training-jobs/{jid}/notes",
                headers=_auth_headers(eng_tok),
                json={"notes": prev_notes},
            )


def test_dataset_upload_and_safe_delete(client: TestClient):
    eng_tok = _login(client, "engineer@neurolab.io", "eng123")
    csv_lines = ["f1,f2,f3,target"]
    for i in range(25):
        csv_lines.append(f"{i * 1.1},{i * 0.5},{100 - i},{i % 2}")
    csv_bytes = "\n".join(csv_lines).encode("utf-8")

    up = client.post(
        "/api/v1/projects/prj-area-retencion/datasets/upload",
        headers=_auth_headers(eng_tok),
        files={"file": ("pytest_sample.csv", csv_bytes, "text/csv")},
        data={"name": "Dataset Test Temporal", "target_column": "target", "scaler_type": "standard"},
    )
    assert up.status_code == 200, up.text
    ds_id = up.json()["id"]
    assert up.json()["input_shape"] == 3

    dele = client.delete(f"/api/v1/datasets/{ds_id}", headers=_auth_headers(eng_tok))
    assert dele.status_code == 200

    after = client.get(f"/api/v1/datasets/{ds_id}", headers=_auth_headers(eng_tok))
    assert after.status_code == 404


def test_dataset_raw_explorer_and_cleaning(client: TestClient):
    eng_tok = _login(client, "engineer@neurolab.io", "eng123")
    rows = ["col_ruido,edad,ingreso,ciudad,fraude"]
    for i in range(18):
        rows.append(f"ID-{i},{20 + i},{1200 + i * 50},Lima,{i % 2}")
    rows.append("ID-DUP,25,1500,Cusco,0")
    rows.append("ID-DUP,25,1500,Cusco,0")
    rows.append("ID-NULL1,,1800,Arequipa,1")
    rows.append("ID-NULL2,35,,Trujillo,0")
    rows.append("ID-OUTLIER,40,950000,Lima,1")
    csv_bytes = "\n".join(rows).encode("utf-8")

    ds_id = None
    clean_ds_id = None
    try:
        up = client.post(
            "/api/v1/projects/prj-area-retencion/datasets/upload",
            headers=_auth_headers(eng_tok),
            files={"file": ("sucio_clientes.csv", csv_bytes, "text/csv")},
            data={
                "name": "Dataset Limpieza Pytest",
                "target_column": "fraude",
                "scaler_type": "standard",
                "missing_strategy": "median_mode",
                "drop_duplicates": "true",
                "outlier_strategy": "iqr_clip",
                "drop_columns": json.dumps(["col_ruido"]),
                "split_ratio": "80/10/10",
            },
        )
        assert up.status_code == 200, up.text
        up_json = up.json()
        ds_id = up_json["id"]
        rep = up_json["metadata"]["cleaning_report"]
        assert rep["rows_before"] == 23
        assert rep["duplicates_removed"] == 1
        assert rep["rows_after"] == 22
        assert rep["null_cells_before"] == 2
        assert rep["null_cells_after"] == 0
        assert rep["outliers_handled"] >= 1
        assert rep["columns_dropped"] == ["col_ruido"]
        assert up_json["splits"]["train_ratio"] == pytest.approx(0.80)

        raw_nulls = client.get(
            f"/api/v1/datasets/{ds_id}/rows",
            headers=_auth_headers(eng_tok),
            params={"source": "raw", "only_nulls": "true", "page": 1, "page_size": 25},
        )
        assert raw_nulls.status_code == 200, raw_nulls.text
        raw_body = raw_nulls.json()
        assert raw_body["source"] == "raw"
        assert raw_body["has_raw_version"] is True
        assert raw_body["total_rows"] == 23
        assert raw_body["total_null_rows"] == 2
        assert raw_body["filtered_rows"] == 2
        assert any(r["edad"] is None or r["ingreso"] is None for r in raw_body["rows"])

        clean_rows = client.get(
            f"/api/v1/datasets/{ds_id}/rows",
            headers=_auth_headers(eng_tok),
            params={"source": "clean", "page": 1, "page_size": 25, "search": "Arequipa"},
        )
        assert clean_rows.status_code == 200, clean_rows.text
        clean_body = clean_rows.json()
        assert clean_body["total_rows"] == 22
        assert clean_body["total_null_cells"] == 0
        assert clean_body["duplicate_rows"] == 0
        assert "col_ruido" not in clean_body["columns"]
        assert clean_body["filtered_rows"] >= 1

        dl = client.get(
            f"/api/v1/datasets/{ds_id}/download",
            headers=_auth_headers(eng_tok),
            params={"source": "raw"},
        )
        assert dl.status_code == 200
        assert "text/csv" in dl.headers.get("content-type", "")
        assert "ID-NULL1" in dl.text

        reclean = client.post(
            f"/api/v1/datasets/{ds_id}/clean",
            headers=_auth_headers(eng_tok),
            json={
                "name": "Dataset Estricto Sin Nulos ni Outliers",
                "target_column": "fraude",
                "missing_strategy": "drop_rows",
                "drop_duplicates": True,
                "outlier_strategy": "iqr_drop",
                "drop_columns": ["col_ruido"],
                "scaler_type": "none",
                "split_ratio": "60/20/20",
            },
        )
        assert reclean.status_code == 200, reclean.text
        reclean_json = reclean.json()
        clean_ds_id = reclean_json["id"]
        rep2 = reclean_json["metadata"]["cleaning_report"]
        assert rep2["rows_before"] == 23
        assert rep2["duplicates_removed"] == 1
        assert rep2["null_cells_after"] == 0
        assert rep2["rows_after"] <= 19
        assert reclean_json["metadata"]["scaler_params"] is None
        assert reclean_json["splits"]["train_ratio"] == pytest.approx(0.60)
    finally:
        if clean_ds_id:
            client.delete(f"/api/v1/datasets/{clean_ds_id}", headers=_auth_headers(eng_tok))
        if ds_id:
            client.delete(f"/api/v1/datasets/{ds_id}", headers=_auth_headers(eng_tok))


def test_dataset_auto_clean_intelligence(client: TestClient):
    eng_tok = _login(client, "engineer@neurolab.io", "eng123")
    rows = ["id_cliente,col_const,col_vacia,edad,ingreso,fraude"]
    for i in range(28):
        const_val = "CONSTANTE"
        vacia_val = "" if i % 2 == 0 else "dato"
        edad_val = "" if i in (3, 9, 17) else str(22 + (i % 15))
        ingreso_val = "980000" if i in (5, 19) else str(1400 + (i % 10) * 120)
        rows.append(f"CLI-{1000 + i},{const_val},{vacia_val},{edad_val},{ingreso_val},{i % 2}")
    rows.append("CLI-1001,CONSTANTE,dato,23,1520,1")
    rows.append("CLI-1002,CONSTANTE,,24,1640,0")
    csv_bytes = "\n".join(rows).encode("utf-8")

    analyze_res = client.post(
        "/api/v1/projects/prj-area-retencion/datasets/analyze-upload",
        headers=_auth_headers(eng_tok),
        files={"file": ("auto_clean_probe.csv", csv_bytes, "text/csv")},
        data={"target_column": "fraude"},
    )
    assert analyze_res.status_code == 200, analyze_res.text
    plan = analyze_res.json()
    rec = plan["recommended"]
    diag = plan["diagnostics"]

    assert rec["target_column"] == "fraude"
    assert "col_const" in rec["drop_columns"]
    assert "col_vacia" in rec["drop_columns"]
    assert "id_cliente" in rec["drop_columns"]
    assert rec["drop_duplicates"] is True
    assert rec["missing_strategy"] == "median_mode"
    assert rec["outlier_strategy"] == "iqr_clip"
    assert rec["scaler_type"] in ("standard", "minmax", "robust")
    assert len(plan["explanations"]) == 6
    assert diag["health_score_before"] < diag["health_score_after"]

    ds_id = None
    try:
        up = client.post(
            "/api/v1/projects/prj-area-retencion/datasets/upload",
            headers=_auth_headers(eng_tok),
            files={"file": ("auto_clean_probe.csv", csv_bytes, "text/csv")},
            data={
                "name": "Dataset Auto Clean Pytest",
                "target_column": rec["target_column"],
                "scaler_type": rec["scaler_type"],
                "missing_strategy": rec["missing_strategy"],
                "drop_duplicates": str(rec["drop_duplicates"]).lower(),
                "outlier_strategy": rec["outlier_strategy"],
                "drop_columns": json.dumps(rec["drop_columns"]),
                "split_ratio": rec["split_ratio"],
            },
        )
        assert up.status_code == 200, up.text
        ds_id = up.json()["id"]

        plan_existing = client.get(
            f"/api/v1/datasets/{ds_id}/auto-clean-plan",
            headers=_auth_headers(eng_tok),
        )
        assert plan_existing.status_code == 200, plan_existing.text
        body2 = plan_existing.json()
        assert "col_const" in body2["recommended"]["drop_columns"]
        assert body2["diagnostics"]["health_score_before"] < body2["diagnostics"]["health_score_after"]
    finally:
        if ds_id:
            client.delete(f"/api/v1/datasets/{ds_id}", headers=_auth_headers(eng_tok))


def test_dataset_automl_advanced_cleaning_and_leakage(client: TestClient):
    eng_tok = _login(client, "engineer@neurolab.io", "eng123")
    rows = ["fecha_alta,ciudad,monto_sucio,edad,edad_doble,fuga_directa,fraude"]
    for i in range(40):
        target_val = 1 if i < 4 else 0
        fuga_val = target_val * 100
        edad_val = 22 + (i % 18)
        edad_doble = edad_val * 2
        ciudad = "lima " if i % 3 == 0 else ("LIMA" if i % 3 == 1 else "Cusco")
        monto = "S/ 1,500,000.00" if i == 10 else f"S/ {1200 + i * 25:,}.50"
        fecha = f"2026-0{(i % 9) + 1}-1{(i % 9)}"
        rows.append(f"{fecha},{ciudad},\"{monto}\",{edad_val},{edad_doble},{fuga_val},{target_val}")
    csv_bytes = "\n".join(rows).encode("utf-8")

    analyze_res = client.post(
        "/api/v1/projects/prj-area-retencion/datasets/analyze-upload",
        headers=_auth_headers(eng_tok),
        files={"file": ("automl_avanzado.csv", csv_bytes, "text/csv")},
        data={"target_column": "fraude"},
    )
    assert analyze_res.status_code == 200, analyze_res.text
    plan = analyze_res.json()
    rec = plan["recommended"]
    diag = plan["diagnostics"]
    alert_types = {a["type"] for a in diag["critical_alerts"]}

    assert rec["normalize_text"] is True
    assert rec["extract_dates"] is True
    assert rec["log_transform_skewed"] is True
    assert rec["stratify_split"] is True
    assert "fuga_directa" in rec["drop_columns"]
    assert "edad_doble" in rec["drop_columns"]
    assert "target_leakage" in alert_types
    assert "multicollinearity" in alert_types
    assert "dirty_format" in alert_types
    assert "class_imbalance" in alert_types
    assert diag["impact_preview"]["estimated_input_shape"] > 0

    ds_id = None
    try:
        up = client.post(
            "/api/v1/projects/prj-area-retencion/datasets/upload",
            headers=_auth_headers(eng_tok),
            files={"file": ("automl_avanzado.csv", csv_bytes, "text/csv")},
            data={
                "name": "Dataset AutoML Completo Pytest",
                "target_column": "fraude",
                "scaler_type": "robust",
                "missing_strategy": "median_mode",
                "drop_duplicates": "true",
                "outlier_strategy": "none",
                "drop_columns": json.dumps(rec["drop_columns"]),
                "split_ratio": "70/15/15",
                "normalize_text": "true",
                "extract_dates": "true",
                "group_rare_categories": "true",
                "log_transform_skewed": "true",
                "stratify_split": "true",
            },
        )
        assert up.status_code == 200, up.text
        meta = up.json()["metadata"]
        ds_id = up.json()["id"]
        rep = meta["cleaning_report"]

        assert meta["scaler_params"]["type"] == "robust"
        assert "monto_sucio" in rep["numeric_repaired"]
        assert "ciudad" in rep["text_normalized"]
        assert "fecha_alta" in rep["dates_extracted"]
        assert "monto_sucio" in rep["log_transformed_columns"]
        assert rep["stratified_applied"] is True
        assert meta["class_balance"]["is_imbalanced"] is True
        assert meta["recommended_class_weights"] is not None
    finally:
        if ds_id:
            client.delete(f"/api/v1/datasets/{ds_id}", headers=_auth_headers(eng_tok))


def test_multiclass_risk_semantic_and_catalog_predict_csv(client: TestClient):
    from app.routes.models import _classify_multiclass_risk

    # Orden alfabético NOC: ['Degradado', 'Falla Critica', 'Operativo']
    assert _classify_multiclass_risk("Operativo", 2, 3) == "BAJO"
    assert _classify_multiclass_risk("Degradado", 0, 3) == "MEDIO"
    assert _classify_multiclass_risk("Falla Critica", 1, 3) == "ALTO"
    # Orden alfabético NOC 5G: ['Critico', 'Estable', 'Saturado']
    assert _classify_multiclass_risk("Critico", 0, 3) == "ALTO"
    assert _classify_multiclass_risk("Estable", 1, 3) == "BAJO"
    assert _classify_multiclass_risk("Saturado", 2, 3) == "MEDIO"

    admin_tok = _login(client, "admin@neurolab.io", "admin123")
    cat_res = client.get("/api/v1/models/catalog", headers=_auth_headers(admin_tok))
    assert cat_res.status_code == 200, cat_res.text
    catalog = cat_res.json()
    assert isinstance(catalog, list) and len(catalog) > 0

    # Validar predict-batch semántico en un modelo multiclase si existe
    noc_model = next(
        (m for m in catalog if (m.get("dataset_metadata") or {}).get("problem_type") == "multiclass_classification"),
        None,
    )
    if noc_model:
        b_res = client.post(
            f"/api/v1/models/{noc_model['id']}/predict-batch",
            headers=_auth_headers(admin_tok),
            json={"limit": 10, "offset": 0},
        )
        assert b_res.status_code == 200, b_res.text
        for item in b_res.json().get("items", []):
            pred_s = str(item["prediction"]).lower()
            if "operativ" in pred_s or "establ" in pred_s:
                assert item["risk_level"] == "BAJO"
            elif "falla" in pred_s or "crit" in pred_s:
                assert item["risk_level"] == "ALTO"
            elif "degrad" in pred_s or "satur" in pred_s:
                assert item["risk_level"] == "MEDIO"

    # Validar predict-csv con 2 filas usando el primer modelo binario disponible
    bin_model = next(
        (m for m in catalog if m.get("project_id") == "prj-area-retencion"),
        catalog[0],
    )
    cols = [
        c for c in (bin_model.get("dataset_metadata") or {}).get("columns_summary", [])
        if not c.get("is_target") and not c.get("excluded_reason")
    ]
    if cols:
        header = ",".join(c["name"] for c in cols)
        row_vals = []
        for c in cols:
            if c.get("dtype") == "numeric":
                row_vals.append(str(round(float(c.get("mean") or 0), 2)))
            else:
                tops = list((c.get("top_values") or {}).keys())
                row_vals.append(str(tops[0]) if tops else "Si")
        csv_payload = f"{header}\n{','.join(row_vals)}\n{','.join(row_vals)}\n".encode("utf-8")
        csv_res = client.post(
            f"/api/v1/models/{bin_model['id']}/predict-csv",
            headers=_auth_headers(admin_tok),
            files={"file": ("test_batch.csv", csv_payload, "text/csv")},
        )
        assert csv_res.status_code == 200, csv_res.text
        data = csv_res.json()
        assert data["total_rows"] == 2
        assert len(data["items"]) == 2
        assert "prediccion_ia" in data["csv_content"]
