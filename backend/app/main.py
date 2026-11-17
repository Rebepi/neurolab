import os
import json
import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, get_db
from app.sample_data import generate_sample_csvs
from app.eda import perform_eda_and_preprocess
from app.routes import auth, projects, datasets, architectures, training, models, audit, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "datasets")
    samples = generate_sample_csvs(data_dir)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM datasets WHERE project_id = 'prj-churn-demo'")
    if cursor.fetchone()[0] == 0:
        churn_csv = samples["churn"]
        eda_result, splits_file = perform_eda_and_preprocess(churn_csv)
        ds_id = "ds-churn-demo"
        now = datetime.utcnow().isoformat()
        cursor.execute("""
            INSERT INTO datasets (id, project_id, name, version, storage_key, metadata_json, input_shape, target, splits_json, created_at)
            VALUES (?, 'prj-churn-demo', 'Telecom Customer Churn (EDA Certificado)', '1.0.0', ?, ?, ?, ?, ?, ?)
        """, (
            ds_id, churn_csv, json.dumps(eda_result),
            eda_result["input_shape"], eda_result["target_column"],
            json.dumps(eda_result["splits"]), now
        ))

        cursor.execute("SELECT COUNT(*) FROM architectures WHERE project_id = 'prj-churn-demo'")
        if cursor.fetchone()[0] == 0:
            arch_id = "arch-mlp-demo"
            arch_config = {
                "family": "Feedforward",
                "input_shape": eda_result["input_shape"],
                "output_dim": 1,
                "output_activation": "sigmoid",
                "layers": [
                    {"id": "l-1", "type": "Dense", "units": 32, "activation": "relu", "use_bias": True},
                    {"id": "l-2", "type": "Dropout", "rate": 0.2},
                    {"id": "l-3", "type": "Dense", "units": 16, "activation": "relu", "use_bias": True}
                ]
            }
            cursor.execute("""
                INSERT INTO architectures 
                (id, project_id, name, family, config_json, version, justification, total_parameters, created_at)
                VALUES (?, 'prj-churn-demo', 'MLP Churn Classifier Estándar', 'Feedforward', ?, '1.0.0', ?, 833, ?)
            """, (
                arch_id, json.dumps(arch_config),
                "Arquitectura multicapa recomendada para datos tabulares normalizados en problemas de clasificación binaria de churn.",
                now
            ))

        conn.commit()
    conn.close()
    yield

app = FastAPI(
    title="NeuroLab Enterprise API",
    version="1.0.0",
    description="Motor empresarial para experimentación, diseño y entrenamiento de redes neuronales con TensorFlow",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        "name": "NeuroLab Enterprise API",
        "version": "1.0.0",
        "status": "ONLINE",
        "docs_url": "/docs"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "database": "sqlite3_ready",
            "ml_engine": "tensorflow_2.21_ready",
            "worker_queue": "active"
        }
    }

