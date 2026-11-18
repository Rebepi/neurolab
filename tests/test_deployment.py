"""Pruebas de integración del empaquetado: datos persistentes y mismo origen."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DeploymentTests(unittest.TestCase):
    def run_isolated(self, code, data_dir, frontend=None):
        env = os.environ.copy()
        env['PYTHONPATH'] = str(ROOT / 'backend')
        env['NEUROLAB_DATA_DIR'] = str(data_dir)
        env.pop('NEUROLAB_FRONTEND_DIR', None)
        env['TF_NUM_INTRAOP_THREADS'] = '1'
        env['TF_NUM_INTEROP_THREADS'] = '1'
        if frontend:
            env['NEUROLAB_FRONTEND_DIR'] = str(frontend)
        result = subprocess.run([sys.executable, '-c', code], env=env,
                                capture_output=True, text=True, timeout=180)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_database_survives_application_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory) / 'persistent'
            self.run_isolated('''
from app.database import init_db, get_db
init_db()
with get_db() as db:
    db.execute("INSERT INTO system_config (key, value) VALUES ('deployment_marker', 'preserved')")
''', data)
            self.run_isolated('''
from app.database import init_db, get_db
init_db()
with get_db() as db:
    assert db.execute("SELECT value FROM system_config WHERE key='deployment_marker'").fetchone()[0] == 'preserved'
''', data)
            self.assertTrue((data / 'neurolab.db').is_file())

    def test_static_frontend_does_not_hide_api_and_health(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            frontend = base / 'frontend'
            frontend.mkdir()
            (frontend / 'index.html').write_text('<html>deployment-marker</html>')
            (frontend / 'asset.js').write_text('console.log("asset")')
            self.run_isolated('''
from fastapi.testclient import TestClient
from app.main import app
from app.paths import DATA_DIR
import time
with TestClient(app) as client:
    assert 'deployment-marker' in client.get('/').text
    assert client.get('/asset.js').status_code == 200
    assert client.get('/health').json()['status'] == 'healthy'
    response = client.post('/api/v1/auth/login', json={'email':'admin@neurolab.io', 'password':'admin123'})
    assert response.status_code == 200, response.text
    assert client.get('/api/v1/projects').status_code == 200
    assert client.get('/api/v1/unknown').status_code == 404
    assert client.get('/../neurolab.db').status_code == 404
    assert (DATA_DIR / 'datasets').is_dir()
    response = client.post('/api/v1/projects/prj-churn-demo/training-jobs', json={
        'architecture_id': 'arch-mlp-demo', 'dataset_id': 'ds-churn-demo',
        'hyperparams': {'epochs': 1, 'batch_size': 128}
    })
    assert response.status_code == 200, response.text
    job_id = response.json()['job_id']
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        job = client.get('/api/v1/training-jobs/' + job_id).json()
        if job['status'] in ('COMPLETED', 'FAILED', 'CANCELLED'):
            break
        time.sleep(0.2)
    assert job['status'] == 'COMPLETED', job
    assert (DATA_DIR / 'models' / (job_id + '.keras')).is_file()
''', base / 'data', frontend)


if __name__ == '__main__':
    unittest.main()
