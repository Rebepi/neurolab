# NeuroLab: trabajo de los agentes

## Operar Azure sin pedir contexto otra vez
- Para cualquier pedido de conexión, encendido, pruebas, apagado o despliegue, leer primero `docs/AGENTES_NUBE.md`.
- Contexto compartido: `infra/azure/lab.manifest.json`. No pedir suscripción, región, VM, IP, DNS ni rutas que ya están allí.
- Entrada diaria: `./servidores.ps1 conectar`, `estado`, `probar`, `diagnostico`, `desplegar`, `apagar`.
- Manual completo para personas: `MANUAL_SERVIDORES.md`. El perfil local se genera con `./servidores.ps1 preparar`.
- Nueva computadora: se requiere inicio de sesión autorizado una vez; no necesita copiar claves SSH ni contraseña RDP para operar con Azure CLI + Run Command.
- Nuevo operador: autorización Azure previa del propietario, descrita en el manual. No conceder permisos ni invitar personas desconocidas automáticamente.
- La solicitud de documentar o hacer push NO autoriza encender VM.

## Proyecto
- Frontend: React/TypeScript/Vite en `frontend/`.
- Backend: FastAPI/TensorFlow/SQLite en `backend/`.
- Infraestructura y operación: `infra/azure/`, `deploy/`, `docs/AZURE.md`.
- Mantener los cambios de nube separados de las funcionalidades que desarrolla el otro integrante.

## Comprobaciones
- Frontend: `cd frontend`, `npm ci --no-audit --no-fund`, `npm run build`, `npm run lint`.
- Backend: instalar `backend/requirements.txt` en un entorno virtual de Python 3.11.
- Ejecutar `python -m unittest discover -s tests` desde la raíz.
- Validar Bicep con `az bicep build --file infra/azure/main.bicep`.
- Comprobar `/health`, inicio de sesión y un entrenamiento pequeño antes de presentar.

## Acceso y costos
- Este archivo da instrucciones; NO concede acceso. Usar la identidad de Azure CLI o una clave SSH local.
- Leer `docs/AZURE.md` antes de operar servidores. Obtener nombres/IP reales con la acción `Connections`.
- No guardar contraseñas, tokens, claves privadas, perfiles de Azure ni datos de usuarios en Git.
- Excepción solicitada por el propietario: `infra/azure/private-backup/neurolab-credentials.enc` es un respaldo AES-256-GCM publicable. La clave AES y el TXT `NEUROLAB_ACCESOS_PRIVADOS.txt` permanecen fuera de Git, en Descargas. No mostrar su contenido en el chat ni crear `.env` con esas claves. Restaurar solo por pedido explícito del propietario.
- No usar SSH con `StrictHostKeyChecking=no`. Verificar la huella del host antes del primer acceso.
- Mantener RDP, SSH y HTTP restringidos al CIDR del operador. No cambiarlo a `0.0.0.0/0`.
- No encender VM por un push, una revisión ni una prueba automática. `Start` solo para una sesión solicitada.
- Si el usuario pide levantar para usar, dejar la sesión abierta y avisar cómo apagarla; terminar el turno del chat no termina su sesión de trabajo.
- Cuando diga que terminó o pida pruebas y cierre, usar `./servidores.ps1 apagar` o `probar-apagar` y comprobar `PowerState/deallocated` en AMBAS VM.
- No borrar el grupo de recursos, discos, base de datos ni modelos para ahorrar crédito sin instrucción expresa.
- No prometer costo cero con VM desasignadas: discos e IP públicas pueden seguir facturándose.

## Datos y despliegue
- `NEUROLAB_DATA_DIR` apunta al almacenamiento persistente. No eliminarlo ni sobrescribirlo al actualizar.
- Un solo proceso Uvicorn: entrenamiento y eventos SSE utilizan memoria del proceso.
- Cada VM tiene su propia SQLite y modelos; no son réplicas ni un clúster.
- La API actual es una demostración: no verifica autorización en todas las rutas. No publicar libremente ni cargar datos reales.
- No ejecutar los `.bat` locales en Azure: activan un túnel Cloudflare ajeno a este despliegue.
- Publicar en GitHub solo cuando el usuario lo solicite; revisar el diff y excluir secretos antes del push. El pedido explícito de push autoriza ese paso.
