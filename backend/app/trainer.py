import os
import json
import time
import hashlib
import threading
import queue
import numpy as np
import sqlite3
from datetime import datetime

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score

from app.database import get_db
from app.paths import DATA_DIR

job_event_queues = {}
job_event_locks = threading.Lock()
cancellation_flags = set()

def register_listener(job_id: str):
    with job_event_locks:
        if job_id not in job_event_queues:
            job_event_queues[job_id] = []
        q = queue.Queue(maxsize=100)
        job_event_queues[job_id].append(q)
        return q

def unregister_listener(job_id: str, q: queue.Queue):
    with job_event_locks:
        if job_id in job_event_queues:
            if q in job_event_queues[job_id]:
                job_event_queues[job_id].remove(q)
            if len(job_event_queues[job_id]) == 0:
                del job_event_queues[job_id]

def broadcast_event(job_id: str, event_data: dict):
    with job_event_locks:
        listeners = job_event_queues.get(job_id, [])
        for q in listeners:
            try:
                q.put_nowait(event_data)
            except queue.Full:
                pass

def request_job_cancellation(job_id: str):
    cancellation_flags.add(job_id)
    conn = get_db()
    conn.execute("UPDATE training_jobs SET cancellation_requested = 1 WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()

class RealtimeCallback(keras.callbacks.Callback):
    def __init__(self, job_id: str, total_epochs: int):
        super().__init__()
        self.job_id = job_id
        self.total_epochs = total_epochs

    def on_epoch_end(self, epoch, logs=None):
        if self.job_id in cancellation_flags:
            self.model.stop_training = True
            return

        logs = logs or {}
        loss = float(logs.get("loss", 0.0))
        accuracy = float(logs.get("accuracy", logs.get("acc", 0.0)))
        val_loss = float(logs.get("val_loss", 0.0))
        val_accuracy = float(logs.get("val_accuracy", logs.get("val_acc", 0.0)))
        cur_epoch = epoch + 1
        progress = round((cur_epoch / self.total_epochs) * 100.0, 1)

        now = datetime.utcnow().isoformat()
        metric_id = f"met-{self.job_id}-{cur_epoch}"

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO training_metrics 
            (id, job_id, epoch, loss, accuracy, val_loss, val_accuracy, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (metric_id, self.job_id, cur_epoch, loss, accuracy, val_loss, val_accuracy, now)
        )

        cursor.execute("SELECT logs_json FROM training_jobs WHERE id = ?", (self.job_id,))
        row = cursor.fetchone()
        existing_logs = json.loads(row[0]) if row and row[0] else []
        log_line = f"[{datetime.now().strftime('%H:%M:%S')}] Epoch {cur_epoch}/{self.total_epochs} - loss: {loss:.4f} - acc: {accuracy:.4f} - val_loss: {val_loss:.4f} - val_acc: {val_accuracy:.4f}"
        existing_logs.append(log_line)

        cursor.execute(
            """
            UPDATE training_jobs 
            SET current_epoch = ?, progress = ?, loss = ?, accuracy = ?, val_loss = ?, val_accuracy = ?, logs_json = ?
            WHERE id = ?
            """,
            (cur_epoch, progress, loss, accuracy, val_loss, val_accuracy, json.dumps(existing_logs[-100:]), self.job_id)
        )
        conn.commit()
        conn.close()

        broadcast_event(self.job_id, {
            "type": "epoch_end",
            "job_id": self.job_id,
            "epoch": cur_epoch,
            "total_epochs": self.total_epochs,
            "progress": progress,
            "loss": loss,
            "accuracy": accuracy,
            "val_loss": val_loss,
            "val_accuracy": val_accuracy,
            "log": log_line
        })

def build_keras_model(architecture_config: dict, input_shape: int, output_dim: int, output_activation: str):
    model = keras.Sequential()
    layers_spec = architecture_config.get("layers", [])

    model.add(keras.Input(shape=(input_shape,)))

    for i, layer_info in enumerate(layers_spec):
        l_type = layer_info.get("type", "Dense").lower()
        units = int(layer_info.get("units", 32))
        activation = layer_info.get("activation", "relu")

        if l_type == "dense":
            use_bias = layer_info.get("use_bias", True)
            model.add(layers.Dense(units=units, activation=activation, use_bias=use_bias))
        elif l_type == "dropout":
            rate = float(layer_info.get("rate", 0.2))
            model.add(layers.Dropout(rate=rate))
        elif l_type == "batchnormalization":
            model.add(layers.BatchNormalization())

    model.add(layers.Dense(units=output_dim, activation=output_activation))
    return model

def run_training_worker(job_id: str):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT tj.project_id, tj.architecture_id, tj.dataset_id, tj.hyperparams_json,
               d.storage_key, d.input_shape, d.target, d.splits_json,
               a.config_json, a.family
        FROM training_jobs tj
        JOIN datasets d ON tj.dataset_id = d.id
        JOIN architectures a ON tj.architecture_id = a.id
        WHERE tj.id = ?
    """, (job_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return

    (project_id, arch_id, dataset_id, hyperparams_raw,
     storage_key, input_shape, target_name, splits_raw,
     config_raw, arch_family) = row

    hyperparams = json.loads(hyperparams_raw)
    splits_meta = json.loads(splits_raw)
    arch_config = json.loads(config_raw)

    now = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE training_jobs SET status = 'PREPARING', started_at = ? WHERE id = ?",
        (now, job_id)
    )
    conn.commit()
    broadcast_event(job_id, {"type": "status_change", "status": "PREPARING", "progress": 5.0})

    try:
        splits_file = storage_key.replace(".csv", "_splits.npz")
        if not os.path.exists(splits_file):
            raise FileNotFoundError(f"Archivo de particiones no encontrado: {splits_file}")

        npz_data = np.load(splits_file)
        X_train = npz_data["X_train"]
        y_train = npz_data["y_train"]
        X_val = npz_data["X_val"]
        y_val = npz_data["y_val"]
        X_test = npz_data["X_test"]
        y_test = npz_data["y_test"]

        output_activation = arch_config.get("output_activation", "sigmoid")
        output_dim = int(arch_config.get("output_dim", 1))

        model = build_keras_model(arch_config, input_shape, output_dim, output_activation)

        opt_name = hyperparams.get("optimizer", "adam").lower()
        lr = float(hyperparams.get("learning_rate", 0.001))

        if opt_name == "sgd":
            opt = keras.optimizers.SGD(learning_rate=lr)
        elif opt_name == "rmsprop":
            opt = keras.optimizers.RMSprop(learning_rate=lr)
        else:
            opt = keras.optimizers.Adam(learning_rate=lr)

        loss_func = hyperparams.get("loss_function", "binary_crossentropy")
        if output_dim > 1 and output_activation == "softmax":
            loss_func = "sparse_categorical_crossentropy"
        elif output_dim == 1 and output_activation == "sigmoid":
            loss_func = "binary_crossentropy"

        model.compile(optimizer=opt, loss=loss_func, metrics=["accuracy"])

        cursor.execute("UPDATE training_jobs SET status = 'RUNNING' WHERE id = ?", (job_id,))
        conn.commit()
        broadcast_event(job_id, {"type": "status_change", "status": "RUNNING", "progress": 10.0})

        epochs = int(hyperparams.get("epochs", 20))
        batch_size = int(hyperparams.get("batch_size", 32))

        cb = RealtimeCallback(job_id=job_id, total_epochs=epochs)
        model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=[cb],
            verbose=0
        )

        if job_id in cancellation_flags:
            cancellation_flags.discard(job_id)
            end_time = datetime.utcnow().isoformat()
            cursor.execute(
                "UPDATE training_jobs SET status = 'CANCELLED', ended_at = ? WHERE id = ?",
                (end_time, job_id)
            )
            audit_id = f"aud-cancel-{int(time.time())}"
            cursor.execute(
                "INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (audit_id, "system", "Worker ML", project_id, "TRAINING_CANCELLED", json.dumps({"job_id": job_id}), end_time)
            )
            conn.commit()
            broadcast_event(job_id, {"type": "status_change", "status": "CANCELLED", "progress": cb.total_epochs})
            conn.close()
            return

        test_eval = model.evaluate(X_test, y_test, verbose=0)
        test_loss = float(test_eval[0])
        test_acc = float(test_eval[1]) if len(test_eval) > 1 else 0.0

        y_pred_probs = model.predict(X_test, verbose=0)
        if output_dim == 1:
            y_pred = (y_pred_probs > 0.5).astype(int).flatten()
            y_true = y_test.astype(int).flatten()
            labels_list = [0, 1]
        else:
            y_pred = np.argmax(y_pred_probs, axis=1)
            y_true = y_test.astype(int).flatten()
            labels_list = list(range(output_dim))

        cm = confusion_matrix(y_true, y_pred, labels=labels_list).tolist()
        prec = float(precision_score(y_true, y_pred, average="weighted", zero_division=0))
        rec = float(recall_score(y_true, y_pred, average="weighted", zero_division=0))
        f1 = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))

        test_metrics = {
            "test_loss": round(test_loss, 4),
            "test_accuracy": round(test_acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "total_test_samples": len(y_test)
        }

        models_dir = str(DATA_DIR / "models")
        os.makedirs(models_dir, exist_ok=True)
        model_save_path = os.path.join(models_dir, f"{job_id}.keras")
        model.save(model_save_path)

        hasher = hashlib.sha256()
        with open(model_save_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                hasher.update(chunk)
        checksum = hasher.hexdigest()

        weights_json_path = os.path.join(models_dir, f"{job_id}_spec.json")
        with open(weights_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "job_id": job_id,
                "project_id": project_id,
                "architecture": arch_config,
                "metrics": test_metrics,
                "checksum": checksum,
                "created_at": datetime.utcnow().isoformat()
            }, f, indent=2)

        end_time = datetime.utcnow().isoformat()
        cursor.execute(
            """
            UPDATE training_jobs 
            SET status = 'COMPLETED', progress = 100.0, ended_at = ?
            WHERE id = ?
            """,
            (end_time, job_id)
        )

        cursor.execute("SELECT COUNT(*) FROM model_versions WHERE project_id = ?", (project_id,))
        v_count = cursor.fetchone()[0] + 1
        version_tag = f"v1.{v_count}.0"
        model_version_id = f"mod-{job_id}"

        cursor.execute(
            """
            INSERT INTO model_versions
            (id, project_id, job_id, version, storage_key, status, checksum, test_metrics_json, confusion_matrix_json, created_at)
            VALUES (?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?)
            """,
            (
                model_version_id, project_id, job_id, version_tag,
                model_save_path, checksum,
                json.dumps(test_metrics), json.dumps(cm),
                end_time
            )
        )

        audit_id = f"aud-comp-{int(time.time())}"
        cursor.execute(
            """
            INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                audit_id, "system", "Worker ML", project_id, "TRAINING_COMPLETED",
                json.dumps({
                    "job_id": job_id,
                    "model_version": version_tag,
                    "accuracy": test_acc,
                    "checksum": checksum[:12]
                }),
                end_time
            )
        )

        conn.commit()
        broadcast_event(job_id, {
            "type": "completed",
            "status": "COMPLETED",
            "progress": 100.0,
            "test_metrics": test_metrics,
            "confusion_matrix": cm,
            "model_version": version_tag
        })

    except Exception as e:
        end_time = datetime.utcnow().isoformat()
        err_msg = str(e)
        cursor.execute(
            "UPDATE training_jobs SET status = 'FAILED', error_message = ?, ended_at = ? WHERE id = ?",
            (err_msg, end_time, job_id)
        )
        audit_id = f"aud-fail-{int(time.time())}"
        cursor.execute(
            """
            INSERT INTO audit_events (id, actor_id, actor_name, project_id, action, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (audit_id, "system", "Worker ML", project_id, "TRAINING_FAILED", json.dumps({"job_id": job_id, "error": err_msg}), end_time)
        )
        conn.commit()
        broadcast_event(job_id, {"type": "failed", "status": "FAILED", "error": err_msg})
    finally:
        conn.close()

def queue_training_job(job_id: str):
    t = threading.Thread(target=run_training_worker, args=(job_id,), daemon=True)
    t.start()
    return t

