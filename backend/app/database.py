import sqlite3
import os
import json
import hashlib
from datetime import datetime
from app.paths import DATA_DIR

DB_PATH = str(DATA_DIR / "neurolab.db")

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(project_id, user_id)
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        storage_key TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        input_shape INTEGER NOT NULL,
        target TEXT NOT NULL,
        splits_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS architectures (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        family TEXT NOT NULL,
        config_json TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        justification TEXT,
        total_parameters INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS training_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        architecture_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        progress REAL NOT NULL DEFAULT 0.0,
        current_epoch INTEGER NOT NULL DEFAULT 0,
        total_epochs INTEGER NOT NULL DEFAULT 20,
        loss REAL,
        accuracy REAL,
        val_loss REAL,
        val_accuracy REAL,
        hyperparams_json TEXT NOT NULL,
        logs_json TEXT NOT NULL DEFAULT '[]',
        error_message TEXT,
        cancellation_requested INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        ended_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (architecture_id) REFERENCES architectures(id) ON DELETE CASCADE,
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS training_metrics (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        epoch INTEGER NOT NULL,
        loss REAL NOT NULL,
        accuracy REAL,
        val_loss REAL,
        val_accuracy REAL,
        recorded_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES training_jobs(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS model_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        version TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'APPROVED',
        checksum TEXT NOT NULL,
        test_metrics_json TEXT NOT NULL,
        confusion_matrix_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES training_jobs(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        project_id TEXT,
        action TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    conn.commit()
    seed_initial_data(conn)
    conn.close()

def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def seed_initial_data(conn):
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()

    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        default_users = [
            ("usr-admin", "admin@neurolab.io", hash_pw("admin123"), "Admin Principal", "Administrador"),
            ("usr-lead", "lead@neurolab.io", hash_pw("lead123"), "Dra. Elena Ramos", "Responsable de proyecto"),
            ("usr-engineer", "engineer@neurolab.io", hash_pw("eng123"), "Ing. Carlos Mendoza", "Ingeniero/analista de IA"),
            ("usr-reviewer", "reviewer@neurolab.io", hash_pw("rev123"), "MSc. Sofía Castro", "Revisor"),
            ("usr-viewer", "viewer@neurolab.io", hash_pw("view123"), "Lucas Romero", "Lector"),
        ]
        cursor.executemany(
            "INSERT INTO users (id, email, password_hash, display_name, role, status, created_at) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)",
            [(u[0], u[1], u[2], u[3], u[4], now) for u in default_users]
        )

        demo_project_id = "prj-churn-demo"
        cursor.execute(
            "INSERT INTO projects (id, name, description, owner_id, status, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                demo_project_id,
                "Predictor de Fuga de Clientes Telecom (Churn)",
                "Modelo neuronal para anticipar la baja voluntaria de clientes residenciales basándose en patrones de consumo, soporte y facturación.",
                "usr-lead",
                "ACTIVE",
                json.dumps(["Telecom", "Clasificación Binaria", "Producción"]),
                now,
                now
            )
        )

        members = [
            ("mem-1", demo_project_id, "usr-lead", "Responsable de proyecto"),
            ("mem-2", demo_project_id, "usr-engineer", "Ingeniero/analista de IA"),
            ("mem-3", demo_project_id, "usr-reviewer", "Revisor"),
            ("mem-4", demo_project_id, "usr-viewer", "Lector"),
        ]
        cursor.executemany(
            "INSERT INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
            [(m[0], m[1], m[2], m[3], now) for m in members]
        )

        audit_entry = (
            "aud-seed-1",
            "usr-admin",
            "Admin Principal",
            demo_project_id,
            "PROJECT_CREATED",
            json.dumps({"name": "Predictor de Fuga de Clientes Telecom (Churn)"}),
            now
        )
        cursor.execute(
            "INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            audit_entry
        )

    cursor.execute("SELECT COUNT(*) FROM system_config")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO system_config (key, value) VALUES ('quotas', ?)",
            (json.dumps({
                "max_concurrent_jobs": 4,
                "max_epochs_per_job": 100,
                "max_dataset_mb": 50,
                "gpu_acceleration": True,
                "retention_days": 90
            }),)
        )

    conn.commit()

