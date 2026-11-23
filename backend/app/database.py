import os
import json
from datetime import datetime, timezone
import bcrypt
import psycopg2
import psycopg2.extras
import psycopg2.pool


def _load_env_file():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or "=" not in line or line.startswith(chr(35)):
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


_load_env_file()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL or not (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")):
    raise RuntimeError("DATABASE_URL debe configurarse apuntando exclusivamente a PostgreSQL.")

_POOL = None


def _get_pool():
    global _POOL
    if _POOL is None:
        _POOL = psycopg2.pool.ThreadedConnectionPool(1, 30, dsn=DATABASE_URL)
    return _POOL


class RowDict(dict):
    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


class PgCursor:
    def __init__(self, cur):
        self._cur = cur

    def execute(self, query: str, params=None):
        if params is None:
            self._cur.execute(query)
        else:
            self._cur.execute(query, params)
        return self

    def executemany(self, query: str, seq_of_params):
        self._cur.executemany(query, seq_of_params)
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return RowDict(row) if row is not None else None

    def fetchall(self):
        return [RowDict(r) for r in self._cur.fetchall()]

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount

    def close(self):
        self._cur.close()


class PgConnection:
    def __init__(self, raw_conn, pool):
        self._conn = raw_conn
        self._pool = pool
        self._closed = False

    def cursor(self):
        return PgCursor(self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))

    def execute(self, query: str, params=None):
        cur = self.cursor()
        cur.execute(query, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        if self._closed:
            return
        self._closed = True
        try:
            if not self._conn.closed:
                self._conn.rollback()
                self._pool.putconn(self._conn)
        except Exception:
            try:
                self._conn.close()
            except Exception:
                pass


def get_db():
    pool = _get_pool()
    raw_conn = pool.getconn()
    return PgConnection(raw_conn, pool)


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(pw: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        return False


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
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, user_id)
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        storage_key TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        input_shape INTEGER NOT NULL,
        target TEXT NOT NULL,
        splits_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS architectures (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        family TEXT NOT NULL,
        config_json TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        justification TEXT,
        total_parameters INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS training_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        architecture_id TEXT NOT NULL REFERENCES architectures(id) ON DELETE CASCADE,
        dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        current_epoch INTEGER NOT NULL DEFAULT 0,
        total_epochs INTEGER NOT NULL DEFAULT 20,
        loss DOUBLE PRECISION,
        accuracy DOUBLE PRECISION,
        val_loss DOUBLE PRECISION,
        val_accuracy DOUBLE PRECISION,
        hyperparams_json TEXT NOT NULL,
        logs_json TEXT NOT NULL DEFAULT '[]',
        error_message TEXT,
        cancellation_requested INTEGER NOT NULL DEFAULT 0,
        cancellation_reason TEXT,
        notes TEXT,
        random_seed INTEGER,
        priority INTEGER NOT NULL DEFAULT 5,
        pause_requested INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        ended_at TEXT,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS cancellation_reason TEXT")
    cursor.execute("ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS notes TEXT")
    cursor.execute("ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS random_seed INTEGER")
    cursor.execute("ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 5")
    cursor.execute("ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS pause_requested INTEGER NOT NULL DEFAULT 0")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS training_metrics (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES training_jobs(id) ON DELETE CASCADE,
        epoch INTEGER NOT NULL,
        loss DOUBLE PRECISION NOT NULL,
        accuracy DOUBLE PRECISION,
        val_loss DOUBLE PRECISION,
        val_accuracy DOUBLE PRECISION,
        recorded_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS model_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        job_id TEXT NOT NULL REFERENCES training_jobs(id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'IN_REVIEW',
        checksum TEXT NOT NULL,
        test_metrics_json TEXT NOT NULL,
        confusion_matrix_json TEXT NOT NULL,
        created_at TEXT NOT NULL
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


def seed_initial_data(conn):
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

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
            "INSERT INTO users (id, email, password_hash, display_name, role, status, created_at) VALUES (%s, %s, %s, %s, %s, 'ACTIVE', %s) ON CONFLICT (id) DO NOTHING",
            [(u[0], u[1], u[2], u[3], u[4], now) for u in default_users],
        )

    enterprise_areas = [
        (
            "prj-area-retencion",
            "Área 01 · Retención y Experiencia del Cliente",
            "Red neuronal de Aura Telecom para anticipar la fuga voluntaria de clientes de Fibra y 5G según facturación, soporte y calidad de enlace.",
            "usr-lead",
            ["Retención", "Clasificación Binaria", "Área 01", "Producción"],
        ),
        (
            "prj-area-noc",
            "Área 02 · Operaciones de Red 5G & Fibra (NOC)",
            "Clasificador neuronal multiclase para detectar degradación térmica, potencia óptica y fallas críticas en torres macro 5G y OLT centrales.",
            "usr-engineer",
            ["Ingeniería NOC", "Multiclase 3 Clases", "Área 02", "5G/Fibra"],
        ),
        (
            "prj-area-antifraude",
            "Área 03 · Seguridad Antifraude & SIM-Swap",
            "Motor neuronal en tiempo real para interceptar fraude en recargas, roaming internacional anómalo y suplantación de tarjeta SIM.",
            "usr-admin",
            ["Ciberseguridad", "Antifraude", "Área 03", "Tiempo Real"],
        ),
        (
            "prj-area-comercial",
            "Área 04 · Crecimiento Comercial & Proyección LTV",
            "Modelo neuronal de regresión continua para estimar el valor anual proyectado (USD) de clientes residenciales, PYME y corporativos.",
            "usr-reviewer",
            ["Comercial", "Regresión LTV", "Área 04", "Ingresos"],
        ),
    ]

    for idx_a, (pid, pname, pdesc, powner, ptags) in enumerate(enterprise_areas, start=1):
        cursor.execute("SELECT COUNT(*) FROM projects WHERE id = %s", (pid,))
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "INSERT INTO projects (id, name, description, owner_id, status, tags, created_at, updated_at) VALUES (%s, %s, %s, %s, 'ACTIVE', %s, %s, %s) ON CONFLICT (id) DO NOTHING",
                (pid, pname, pdesc, powner, json.dumps(ptags), now, now),
            )
            members = [
                (f"mem-{idx_a}-1", pid, "usr-lead", "Responsable de proyecto"),
                (f"mem-{idx_a}-2", pid, "usr-engineer", "Ingeniero/analista de IA"),
                (f"mem-{idx_a}-3", pid, "usr-reviewer", "Revisor"),
                (f"mem-{idx_a}-4", pid, "usr-viewer", "Lector"),
            ]
            cursor.executemany(
                "INSERT INTO project_members (id, project_id, user_id, role, created_at) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (project_id, user_id) DO NOTHING",
                [(m[0], m[1], m[2], m[3], now) for m in members],
            )
            cursor.execute(
                "INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
                (f"aud-seed-{idx_a}", "usr-admin", "Admin Principal", pid, "PROJECT_CREATED", json.dumps({"name": pname}), now),
            )

    cursor.execute(
        "INSERT INTO system_config (key, value) VALUES ('quotas', %s) ON CONFLICT (key) DO NOTHING",
        (
            json.dumps({
                "max_concurrent_jobs": 4,
                "max_epochs_per_job": 100,
                "max_dataset_mb": 50,
                "gpu_acceleration": True,
                "retention_days": 90,
                "max_batch_size": 128,
                "mixed_precision": False,
                "random_seed": 42,
            }),
        ),
    )

    cursor.execute(
        "INSERT INTO system_config (key, value) VALUES ('policies', %s) ON CONFLICT (key) DO NOTHING",
        (
            json.dumps({
                "dataset_split_ratio": "70/15/15",
                "min_certification_accuracy": 75,
                "auto_approve_models": False,
                "early_stopping_enabled": True,
                "early_stopping_patience": 5,
                "session_timeout_minutes": 480,
                "strict_inference_audit": True,
                "require_sha256_export": True,
            }),
        ),
    )

    conn.commit()
