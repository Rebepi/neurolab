import os
import json

os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import tensorflow as tf
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, get_db
from app.sample_data import generate_sample_csvs
from app.eda import perform_eda_and_preprocess
from app.trainer import ensure_worker_pool_started
from app.routes import auth, projects, datasets, architectures, training, models, audit, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_worker_pool_started()

    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(backend_root, "data", "datasets")
    export_dir = os.path.join(os.path.dirname(backend_root), "datasets_empresa")
    samples = generate_sample_csvs(data_dir, export_dir=export_dir)

    area_seeds = [
        (
            "prj-area-retencion",
            "ds-area1-retencion",
            "Área 01 · Retención de Clientes 15K (Fuga)",
            samples["retencion"],
            "fuga",
            "arch-area1-retencion",
            "MLP Retención Profunda (64→32→16)",
            [
                {"id": "l-1", "type": "Dense", "units": 64, "activation": "relu", "use_bias": True},
                {"id": "l-2", "type": "BatchNormalization"},
                {"id": "l-3", "type": "Dropout", "rate": 0.2},
                {"id": "l-4", "type": "Dense", "units": 32, "activation": "relu", "use_bias": True},
                {"id": "l-5", "type": "Dense", "units": 16, "activation": "relu", "use_bias": True},
            ],
            "Topología multicapa con BatchNormalization y Dropout optimizada para clasificación binaria de fuga en 15,000 clientes Telecom.",
        ),
        (
            "prj-area-noc",
            "ds-area2-noc",
            "Área 02 · Telemetría Red NOC 12K (3 Estados)",
            samples["red_noc"],
            "estado_nodo",
            "arch-area2-noc",
            "MLP Diagnóstico NOC Multiclase (64→32)",
            [
                {"id": "l-1", "type": "Dense", "units": 64, "activation": "relu", "use_bias": True},
                {"id": "l-2", "type": "Dropout", "rate": 0.15},
                {"id": "l-3", "type": "Dense", "units": 32, "activation": "relu", "use_bias": True},
            ],
            "Clasificador neuronal multiclase (Softmax) para detectar estados Operativo, Degradado y Falla Crítica en infraestructura 5G y Fibra.",
        ),
        (
            "prj-area-antifraude",
            "ds-area3-antifraude",
            "Área 03 · Transacciones Antifraude 12K (SIM/Roaming)",
            samples["antifraude"],
            "fraude",
            "arch-area3-antifraude",
            "MLP Escudo Antifraude (64→32→16)",
            [
                {"id": "l-1", "type": "Dense", "units": 64, "activation": "relu", "use_bias": True},
                {"id": "l-2", "type": "Dropout", "rate": 0.25},
                {"id": "l-3", "type": "Dense", "units": 32, "activation": "relu", "use_bias": True},
                {"id": "l-4", "type": "Dense", "units": 16, "activation": "relu", "use_bias": True},
            ],
            "Red neuronal regularizada para detección en milisegundos de operaciones fraudulentas, SIM-Swap y anomalías de roaming.",
        ),
        (
            "prj-area-comercial",
            "ds-area4-comercial",
            "Área 04 · Proyección Comercial LTV 10K (USD)",
            samples["comercial_ltv"],
            "valor_anual_usd",
            "arch-area4-comercial",
            "MLP Regresor Financiero LTV (64→32→16)",
            [
                {"id": "l-1", "type": "Dense", "units": 64, "activation": "relu", "use_bias": True},
                {"id": "l-2", "type": "Dense", "units": 32, "activation": "relu", "use_bias": True},
                {"id": "l-3", "type": "Dense", "units": 16, "activation": "relu", "use_bias": True},
            ],
            "Arquitectura neuronal de salida lineal continua diseñada para proyectar ingresos anuales esperados por cliente (LTV en USD).",
        ),
    ]

    secondary_seeds = [
        (
            "prj-area-retencion",
            "ds-area1-retencion-q4",
            "Área 01 · Campaña Retención Q4 5K (Fuga)",
            samples["retencion_q4"],
            "fuga",
        ),
        (
            "prj-area-noc",
            "ds-area2-noc-reg",
            "Área 02 · Nodos Regionales NOC 4K (3 Estados)",
            samples["red_noc_regional"],
            "estado_nodo",
        ),
        (
            "prj-area-antifraude",
            "ds-area3-antifraude-roam",
            "Área 03 · Tráfico Roaming Antifraude 4K",
            samples["antifraude_roaming"],
            "fraude",
        ),
        (
            "prj-area-comercial",
            "ds-area4-comercial-b2b",
            "Área 04 · Cartera Empresarial B2B 4K (USD)",
            samples["comercial_b2b"],
            "valor_anual_usd",
        ),
    ]

    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

    for pid, ds_id, ds_name, csv_path, target_col, arch_id, arch_name, layers_cfg, justif in area_seeds:
        cursor.execute("SELECT COUNT(*) FROM projects WHERE id = %s", (pid,))
        if cursor.fetchone()[0] == 0:
            continue

        cursor.execute("SELECT COUNT(*) FROM datasets WHERE id = %s", (ds_id,))
        if cursor.fetchone()[0] == 0:
            eda_result, _ = perform_eda_and_preprocess(csv_path, target_column=target_col, scaler_type="standard")
            cursor.execute(
                """
                INSERT INTO datasets (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
                VALUES (%s, %s, %s, '1.0.0', %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    storage_key = EXCLUDED.storage_key,
                    metadata_json = EXCLUDED.metadata_json,
                    input_shape = EXCLUDED.input_shape,
                    target = EXCLUDED.target,
                    splits_json = EXCLUDED.splits_json
                """,
                (
                    ds_id,
                    pid,
                    ds_name,
                    csv_path,
                    json.dumps(eda_result),
                    eda_result["input_shape"],
                    eda_result["target_column"],
                    json.dumps(eda_result["splits"]),
                    now,
                ),
            )

        cursor.execute("SELECT COUNT(*) FROM architectures WHERE project_id = %s", (pid,))
        if cursor.fetchone()[0] == 0:
            eda_for_arch, _ = perform_eda_and_preprocess(csv_path, target_column=target_col, scaler_type="standard")
            arch_config = {
                "family": "Feedforward",
                "input_shape": eda_for_arch["input_shape"],
                "output_dim": eda_for_arch["output_dim"],
                "output_activation": eda_for_arch["output_activation"],
                "layers": layers_cfg,
            }
            curr_d = eda_for_arch["input_shape"]
            total_p = 0
            for layer in layers_cfg:
                if layer["type"] == "Dense":
                    u = layer["units"]
                    total_p += curr_d * u + u
                    curr_d = u
                elif layer["type"] == "BatchNormalization":
                    total_p += 4 * curr_d
            total_p += curr_d * eda_for_arch["output_dim"] + eda_for_arch["output_dim"]

            cursor.execute(
                """
                INSERT INTO architectures
                (id, project_id, name, family, config_json, version, justification, total_parameters, created_at)
                VALUES (%s, %s, %s, 'Feedforward', %s, '1.0.0', %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (arch_id, pid, arch_name, json.dumps(arch_config), justif, total_p, now),
            )

    for pid, ds_id, ds_name, csv_path, target_col in secondary_seeds:
        cursor.execute("SELECT COUNT(*) FROM projects WHERE id = %s", (pid,))
        if cursor.fetchone()[0] == 0:
            continue

        cursor.execute("SELECT COUNT(*) FROM datasets WHERE id = %s", (ds_id,))
        if cursor.fetchone()[0] == 0:
            eda_result, _ = perform_eda_and_preprocess(csv_path, target_column=target_col, scaler_type="standard")
            cursor.execute(
                """
                INSERT INTO datasets (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
                VALUES (%s, %s, %s, '1.1.0', %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    storage_key = EXCLUDED.storage_key,
                    metadata_json = EXCLUDED.metadata_json,
                    input_shape = EXCLUDED.input_shape,
                    target = EXCLUDED.target,
                    splits_json = EXCLUDED.splits_json
                """,
                (
                    ds_id,
                    pid,
                    ds_name,
                    csv_path,
                    json.dumps(eda_result),
                    eda_result["input_shape"],
                    eda_result["target_column"],
                    json.dumps(eda_result["splits"]),
                    now,
                ),
            )

    conn.commit()
    conn.close()
    yield


raw_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:28400,http://127.0.0.1:28400,http://localhost:5173,http://127.0.0.1:5173,https://neurolab.rebepi.com",
)
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app = FastAPI(
    title="Aura Telecom Enterprise · NeuroLab AI API",
    version="2.0.0",
    description="Plataforma Corporativa Multi-Área de Redes Neuronales Profundas con TensorFlow y Keras",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(datasets.router)
app.include_router(architectures.router)
app.include_router(training.router)
app.include_router(models.router)
app.include_router(audit.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {
        "name": "Aura Telecom Enterprise · NeuroLab AI API",
        "version": "2.0.0",
        "status": "ONLINE",
        "docs_url": "/docs",
    }


@app.get("/health")
def health():
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
    finally:
        conn.close()

    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
        "services": {
            "database": "postgresql_ready",
            "ml_engine": "tensorflow_2.21_ready",
            "worker_queue": "active",
        },
    }
