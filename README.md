# NeuroLab

Plataforma académica de experimentación con redes neuronales: React/Vite y FastAPI/TensorFlow.

Para usar los servidores desde casa o dar acceso al compañero, empezar por **[MANUAL_SERVIDORES.md](MANUAL_SERVIDORES.md)**. Incluye instalación inicial, permisos, comandos diarios, RDP/SSH, pruebas, despliegue, recuperación y costos.

Con PowerShell 7 y acceso Azure preparado:

```powershell
./servidores.ps1 conectar
# Trabajar o presentar; al terminar:
./servidores.ps1 apagar
```

Los agentes leen [AGENTS.md](AGENTS.md) y [el procedimiento de nube](docs/AGENTES_NUBE.md). El contexto no secreto ya está en el manifiesto del proyecto. La [guía técnica de Azure](docs/AZURE.md) detalla infraestructura e instalación. GitHub Actions valida y empaqueta; no enciende VM ni despliega automáticamente.

## Desarrollo local

Se recomienda Node.js 24 y Python 3.11. Desde la raíz:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt httpx
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 28401
```

En otra terminal:

```powershell
cd frontend
npm ci --no-audit --no-fund
npm run dev
```

Visitar `http://localhost:28400`. Para probar los cambios de despliegue:

```powershell
.\.venv\Scripts\python -m unittest discover -s tests -v
```

Los usuarios iniciales son de demostración (ver `backend/app/database.py`). La API necesita autorización efectiva antes de abrirse a Internet o usarse con datos reales.
