import os
import json
import time
import hashlib
import threading
import queue
import itertools

os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
from datetime import datetime, timezone

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score, r2_score

from app.database import get_db
from app.security import get_system_policies_dict, get_system_quotas_dict, log_audit_event

job_event_queues = {}
job_event_locks = threading.Lock()
cancellation_flags = {}
pause_flags = set()
pause_condition = threading.Condition()

_job_priority_queue = queue.PriorityQueue()
_job_seq = itertools.count()
_active_workers_lock = threading.Lock()
_active_workers = 0
_dispatcher_started = False


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
        listeners = list(job_event_queues.get(job_id, []))
    for q in listeners:
        try:
            q.put_nowait(event_data)
        except queue.Full:
            pass


def request_job_cancellation(job_id: str, reason: str = None):
    cancellation_flags[job_id] = reason or "Cancelación solicitada por el usuario"
    pause_flags.discard(job_id)
    with pause_condition:
        pause_condition.notify_all()
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT status, project_id FROM training_jobs WHERE id = %s",
            (job_id,),
        )
        row = cur.fetchone()
        cur.execute(
            "UPDATE training_jobs SET cancellation_requested = 1, cancellation_reason = %s WHERE id = %s",
            (cancellation_flags[job_id], job_id),
        )
        if row and row["status"] in ("QUEUED", "PAUSED"):
            end_time = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
            cur.execute(
                "UPDATE training_jobs SET status = 'CANCELLED', ended_at = %s WHERE id = %s",
                (end_time, job_id),
            )
            log_audit_event(
                conn,
                "system",
                "Worker ML",
                row["project_id"],
                "TRAINING_CANCELLED",
                {"job_id": job_id, "reason": cancellation_flags[job_id]},
            )
            broadcast_event(
                job_id,
                {"type": "cancelled", "status": "CANCELLED", "reason": cancellation_flags[job_id]},
            )
        conn.commit()
    finally:
        conn.close()


def request_job_pause(job_id: str):
    pause_flags.add(job_id)
    conn = get_db()
    try:
        conn.execute("UPDATE training_jobs SET pause_requested = 1 WHERE id = %s", (job_id,))
        conn.commit()
    finally:
        conn.close()


def request_job_resume(job_id: str):
    pause_flags.discard(job_id)
    conn = get_db()
    try:
        conn.execute("UPDATE training_jobs SET pause_requested = 0 WHERE id = %s", (job_id,))
        conn.commit()
    finally:
        conn.close()
    with pause_condition:
        pause_condition.notify_all()


class RealtimeCallback(keras.callbacks.Callback):
    def __init__(self, job_id: str, total_epochs: int, target_scale: float = 1.0):
        super().__init__()
        self.job_id = job_id
        self.total_epochs = total_epochs
        self.target_scale = max(1.0, float(target_scale))

    def on_epoch_end(self, epoch, logs=None):
        if self.job_id in cancellation_flags:
            self.model.stop_training = True
            return

        if self.job_id in pause_flags:
            conn = get_db()
            try:
                conn.execute("UPDATE training_jobs SET status = 'PAUSED' WHERE id = %s", (self.job_id,))
                conn.commit()
            finally:
                conn.close()
            broadcast_event(self.job_id, {"type": "status_change", "status": "PAUSED"})

            with pause_condition:
                while self.job_id in pause_flags and self.job_id not in cancellation_flags:
                    pause_condition.wait(timeout=0.3)

            if self.job_id in cancellation_flags:
                self.model.stop_training = True
                return

            conn = get_db()
            try:
                conn.execute("UPDATE training_jobs SET status = 'RUNNING', pause_requested = 0 WHERE id = %s", (self.job_id,))
                conn.commit()
            finally:
                conn.close()
            broadcast_event(self.job_id, {"type": "status_change", "status": "RUNNING"})

        logs = logs or {}
        loss = float(logs.get("loss", 0.0))
        if "accuracy" in logs or "acc" in logs:
            accuracy = float(logs.get("accuracy", logs.get("acc", 0.0)))
        else:
            mae_val = float(logs.get("mae", loss))
            accuracy = float(max(0.0, min(0.99, 1.0 - mae_val / self.target_scale)))
        val_loss = float(logs.get("val_loss", 0.0))
        if "val_accuracy" in logs or "val_acc" in logs:
            val_accuracy = float(logs.get("val_accuracy", logs.get("val_acc", 0.0)))
        else:
            val_mae = float(logs.get("val_mae", val_loss))
            val_accuracy = float(max(0.0, min(0.99, 1.0 - val_mae / self.target_scale)))
        cur_epoch = epoch + 1
        progress = round((cur_epoch / self.total_epochs) * 100.0, 1)

        now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        metric_id = f"met-{self.job_id}-{cur_epoch}"

        conn = get_db()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO training_metrics
                (id, job_id, epoch, loss, accuracy, val_loss, val_accuracy, recorded_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    loss = EXCLUDED.loss,
                    accuracy = EXCLUDED.accuracy,
                    val_loss = EXCLUDED.val_loss,
                    val_accuracy = EXCLUDED.val_accuracy,
                    recorded_at = EXCLUDED.recorded_at
                """,
                (metric_id, self.job_id, cur_epoch, loss, accuracy, val_loss, val_accuracy, now),
            )

            cursor.execute("SELECT logs_json FROM training_jobs WHERE id = %s", (self.job_id,))
            row = cursor.fetchone()
            existing_logs = json.loads(row[0]) if row and row[0] else []
            log_line = f"[{datetime.now().strftime('%H:%M:%S')}] Epoch {cur_epoch}/{self.total_epochs} - loss: {loss:.4f} - acc: {accuracy:.4f} - val_loss: {val_loss:.4f} - val_acc: {val_accuracy:.4f}"
            existing_logs.append(log_line)

            cursor.execute(
                """
                UPDATE training_jobs
                SET current_epoch = %s, progress = %s, loss = %s, accuracy = %s, val_loss = %s, val_accuracy = %s, logs_json = %s
                WHERE id = %s
                """,
                (cur_epoch, progress, loss, accuracy, val_loss, val_accuracy, json.dumps(existing_logs[-100:]), self.job_id),
            )
            conn.commit()
        finally:
            conn.close()

        broadcast_event(
            self.job_id,
            {
                "type": "epoch_end",
                "job_id": self.job_id,
                "epoch": cur_epoch,
                "total_epochs": self.total_epochs,
                "progress": progress,
                "loss": loss,
                "accuracy": accuracy,
                "val_loss": val_loss,
                "val_accuracy": val_accuracy,
                "log": log_line,
            },
        )


def build_keras_model(
    architecture_config: dict,
    input_shape: int,
    output_dim: int,
    output_activation: str,
    family: str = None,
):
    model = keras.Sequential()
    layers_spec = architecture_config.get("layers", [])
    arch_family = family or architecture_config.get("family", "Feedforward")

    model.add(keras.Input(shape=(input_shape,)))

    is_seq = False
    seq_len = input_shape

    if arch_family in ("CNN", "RNN"):
        has_seq_layer = any(
            l.get("type", "").lower() in ("conv1d", "maxpooling1d", "lstm", "gru")
            for l in layers_spec
        )
        if has_seq_layer:
            model.add(layers.Reshape((input_shape, 1)))
            is_seq = True

    for i, layer_info in enumerate(layers_spec):
        l_type = layer_info.get("type", "Dense").lower()
        units = int(layer_info.get("units", 32))
        activation = layer_info.get("activation", "relu")

        if l_type == "conv1d":
            if not is_seq:
                model.add(layers.Reshape((seq_len, 1)))
                is_seq = True
            filters = int(layer_info.get("filters") or units or 32)
            kernel = max(1, min(int(layer_info.get("kernel_size") or 3), seq_len))
            padding = (layer_info.get("padding") or "same").lower()
            if padding not in ("same", "valid"):
                padding = "same"
            use_bias = layer_info.get("use_bias", True)
            model.add(
                layers.Conv1D(
                    filters=filters,
                    kernel_size=kernel,
                    padding=padding,
                    activation=activation,
                    use_bias=use_bias,
                )
            )
            if padding == "valid":
                seq_len = max(1, seq_len - kernel + 1)
        elif l_type == "maxpooling1d":
            if is_seq:
                pool_size = max(1, min(int(layer_info.get("pool_size") or 2), seq_len))
                model.add(layers.MaxPooling1D(pool_size=pool_size))
                seq_len = max(1, seq_len // pool_size)
        elif l_type == "flatten":
            if is_seq:
                model.add(layers.Flatten())
                is_seq = False
        elif l_type in ("lstm", "gru"):
            if not is_seq:
                model.add(layers.Reshape((seq_len, 1)))
                is_seq = True
            has_next_rnn = any(
                nxt.get("type", "").lower() in ("lstm", "gru")
                for nxt in layers_spec[i + 1 :]
            )
            if l_type == "lstm":
                model.add(layers.LSTM(units=units, return_sequences=has_next_rnn))
            else:
                model.add(layers.GRU(units=units, return_sequences=has_next_rnn))
            is_seq = has_next_rnn
        elif l_type == "dense":
            if is_seq:
                model.add(layers.Flatten())
                is_seq = False
            use_bias = layer_info.get("use_bias", True)
            if arch_family == "GAN" and activation == "relu":
                model.add(layers.Dense(units=units, use_bias=use_bias))
                model.add(layers.LeakyReLU(negative_slope=0.2))
            else:
                model.add(layers.Dense(units=units, activation=activation, use_bias=use_bias))
        elif l_type == "dropout":
            rate = float(layer_info.get("rate", 0.2))
            model.add(layers.Dropout(rate=rate))
        elif l_type == "batchnormalization":
            model.add(layers.BatchNormalization())

    if is_seq:
        model.add(layers.Flatten())

    model.add(layers.Dense(units=output_dim, activation=output_activation))
    return model


def run_training_worker(job_id: str):
    if job_id in cancellation_flags:
        cancellation_flags.pop(job_id, None)
        return

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT tj.project_id, tj.architecture_id, tj.dataset_id, tj.hyperparams_json, tj.random_seed,
               d.storage_key, d.input_shape, d.target, d.splits_json, d.metadata_json,
               a.config_json, a.family
        FROM training_jobs tj
        JOIN datasets d ON tj.dataset_id = d.id
        JOIN architectures a ON tj.architecture_id = a.id
        WHERE tj.id = %s
        """,
        (job_id,),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        return

    quotas = get_system_quotas_dict(conn)
    policies = get_system_policies_dict(conn)

    project_id = row["project_id"]
    storage_key = row["storage_key"]
    input_shape = row["input_shape"]
    ds_meta_raw = row["metadata_json"]
    config_raw = row["config_json"]
    arch_family = row["family"]
    hyperparams = json.loads(row["hyperparams_json"])
    ds_meta = json.loads(ds_meta_raw or "{}")
    arch_config = json.loads(config_raw)

    seed = int(row["random_seed"] if row["random_seed"] is not None else quotas.get("random_seed", 42))
    np.random.seed(seed)
    tf.keras.utils.set_random_seed(seed)

    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    cursor.execute(
        "UPDATE training_jobs SET status = 'PREPARING', started_at = %s WHERE id = %s",
        (now, job_id),
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

        problem_type = ds_meta.get("problem_type", "binary_classification")
        output_activation = ds_meta.get("output_activation") or arch_config.get("output_activation", "sigmoid")
        output_dim = int(ds_meta.get("output_dim") or arch_config.get("output_dim", 1))
        actual_input_shape = int(X_train.shape[1]) if X_train.ndim == 2 else int(input_shape)

        model = build_keras_model(arch_config, actual_input_shape, output_dim, output_activation, family=arch_family)

        opt_name = hyperparams.get("optimizer", "adam").lower()
        lr = float(hyperparams.get("learning_rate", 0.001))

        if opt_name == "sgd":
            opt = keras.optimizers.SGD(learning_rate=lr)
        elif opt_name == "rmsprop":
            opt = keras.optimizers.RMSprop(learning_rate=lr)
        else:
            opt = keras.optimizers.Adam(learning_rate=lr)

        if problem_type == "regression" or output_activation == "linear":
            loss_func = "mean_squared_error"
            compile_metrics = ["mae"]
        elif output_dim > 1 and output_activation == "softmax":
            loss_func = "sparse_categorical_crossentropy"
            compile_metrics = ["accuracy"]
        else:
            loss_func = "binary_crossentropy"
            compile_metrics = ["accuracy"]

        model.compile(optimizer=opt, loss=loss_func, metrics=compile_metrics)

        cursor.execute("UPDATE training_jobs SET status = 'RUNNING' WHERE id = %s", (job_id,))
        conn.commit()
        broadcast_event(job_id, {"type": "status_change", "status": "RUNNING", "progress": 10.0})

        epochs = int(hyperparams.get("epochs", 20))
        batch_size = int(hyperparams.get("batch_size", 32))

        y_scale = float(np.std(y_train)) * 2.5 if problem_type == "regression" and len(y_train) > 0 else 1.0
        cb = RealtimeCallback(job_id=job_id, total_epochs=epochs, target_scale=y_scale)
        callbacks_list = [cb]
        if policies.get("early_stopping_enabled"):
            patience = max(2, int(policies.get("early_stopping_patience", 5)))
            callbacks_list.append(
                keras.callbacks.EarlyStopping(
                    monitor="val_loss",
                    patience=patience,
                    restore_best_weights=True,
                )
            )

        class_weight_arg = None
        if problem_type != "regression" and ds_meta.get("recommended_class_weights"):
            class_weight_arg = {
                int(k): float(v)
                for k, v in ds_meta["recommended_class_weights"].items()
            }

        fit_kwargs = {
            "validation_data": (X_val, y_val),
            "epochs": epochs,
            "batch_size": batch_size,
            "callbacks": callbacks_list,
            "verbose": 0,
        }
        if class_weight_arg:
            fit_kwargs["class_weight"] = class_weight_arg

        model.fit(
            X_train,
            y_train,
            **fit_kwargs,
        )

        if job_id in cancellation_flags:
            cancel_reason = cancellation_flags.pop(job_id, "Cancelado por el usuario")
            pause_flags.discard(job_id)
            end_time = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
            cursor.execute(
                "UPDATE training_jobs SET status = 'CANCELLED', cancellation_reason = %s, ended_at = %s WHERE id = %s",
                (cancel_reason, end_time, job_id),
            )
            log_audit_event(
                conn,
                "system",
                "Worker ML",
                project_id,
                "TRAINING_CANCELLED",
                {"job_id": job_id, "reason": cancel_reason},
            )
            conn.commit()
            broadcast_event(job_id, {"type": "cancelled", "status": "CANCELLED", "progress": cb.total_epochs, "reason": cancel_reason})
            return

        test_eval = model.evaluate(X_test, y_test, verbose=0)
        test_loss = float(test_eval[0])
        y_pred_probs = model.predict(X_test, verbose=0)

        if problem_type == "regression" or output_activation == "linear":
            y_pred_flat = y_pred_probs.flatten().astype(float)
            y_true_flat = y_test.flatten().astype(float)
            r2 = float(max(0.0, min(1.0, r2_score(y_true_flat, y_pred_flat))))
            test_acc = r2
            prec = r2
            rec = r2
            f1 = r2
            med = float(np.median(y_true_flat))
            cm = confusion_matrix((y_true_flat >= med).astype(int), (y_pred_flat >= med).astype(int), labels=[0, 1]).tolist()
        else:
            test_acc = float(test_eval[1]) if len(test_eval) > 1 else 0.0
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
            "total_test_samples": len(y_test),
        }

        models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "models")
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
            json.dump(
                {
                    "job_id": job_id,
                    "project_id": project_id,
                    "architecture": arch_config,
                    "metrics": test_metrics,
                    "checksum": checksum,
                    "random_seed": seed,
                    "created_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                },
                f,
                indent=2,
            )

        end_time = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        cursor.execute(
            """
            UPDATE training_jobs
            SET status = 'COMPLETED', progress = 100.0, ended_at = %s
            WHERE id = %s
            """,
            (end_time, job_id),
        )

        cursor.execute("SELECT COUNT(*) FROM model_versions WHERE project_id = %s", (project_id,))
        v_count = cursor.fetchone()[0] + 1
        version_tag = f"v1.{v_count}.0"
        model_version_id = f"mod-{job_id}"

        min_cert_acc = float(policies.get("min_certification_accuracy", 75))
        auto_approve = bool(policies.get("auto_approve_models", False))
        initial_model_status = "APPROVED" if (auto_approve and test_acc * 100.0 >= min_cert_acc) else "IN_REVIEW"

        cursor.execute(
            """
            INSERT INTO model_versions
            (id, project_id, job_id, version, storage_key, status, checksum, test_metrics_json, confusion_matrix_json, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                model_version_id,
                project_id,
                job_id,
                version_tag,
                model_save_path,
                initial_model_status,
                checksum,
                json.dumps(test_metrics),
                json.dumps(cm),
                end_time,
            ),
        )

        log_audit_event(
            conn,
            "system",
            "Worker ML",
            project_id,
            "TRAINING_COMPLETED",
            {
                "job_id": job_id,
                "model_version": version_tag,
                "model_status": initial_model_status,
                "accuracy": test_acc,
                "checksum": checksum[:12],
            },
        )
        conn.commit()
        broadcast_event(
            job_id,
            {
                "type": "completed",
                "status": "COMPLETED",
                "progress": 100.0,
                "test_metrics": test_metrics,
                "confusion_matrix": cm,
                "model_version": version_tag,
            },
        )

    except Exception as e:
        end_time = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        err_msg = str(e)
        cursor.execute(
            "UPDATE training_jobs SET status = 'FAILED', error_message = %s, ended_at = %s WHERE id = %s",
            (err_msg, end_time, job_id),
        )
        log_audit_event(
            conn,
            "system",
            "Worker ML",
            project_id,
            "TRAINING_FAILED",
            {"job_id": job_id, "error": err_msg},
        )
        conn.commit()
        broadcast_event(job_id, {"type": "failed", "status": "FAILED", "error": err_msg})
    finally:
        pause_flags.discard(job_id)
        cancellation_flags.pop(job_id, None)
        conn.close()


def _run_worker_wrapper(job_id: str):
    global _active_workers
    try:
        run_training_worker(job_id)
    finally:
        with _active_workers_lock:
            _active_workers = max(0, _active_workers - 1)


def _dispatcher_loop():
    global _active_workers
    while True:
        priority, seq, job_id = _job_priority_queue.get()
        while True:
            max_conc = 4
            try:
                conn = get_db()
                try:
                    quotas = get_system_quotas_dict(conn)
                    max_conc = max(1, int(quotas.get("max_concurrent_jobs", 4)))
                finally:
                    conn.close()
            except Exception:
                pass
            with _active_workers_lock:
                if _active_workers < max_conc:
                    _active_workers += 1
                    break
            time.sleep(0.25)

        t = threading.Thread(target=_run_worker_wrapper, args=(job_id,), daemon=True)
        t.start()
        _job_priority_queue.task_done()


def ensure_worker_pool_started():
    global _dispatcher_started
    if not _dispatcher_started:
        _dispatcher_started = True
        t = threading.Thread(target=_dispatcher_loop, daemon=True)
        t.start()


def queue_training_job(job_id: str, priority: int = 5):
    ensure_worker_pool_started()
    seq = next(_job_seq)
    _job_priority_queue.put((int(priority), seq, job_id))
