"""Ubicación compartida para los datos persistentes en local y en servidores."""

import os
from pathlib import Path

DATA_DIR = Path(os.environ.get(
    "NEUROLAB_DATA_DIR", Path(__file__).resolve().parents[1] / "data"
)).resolve()
