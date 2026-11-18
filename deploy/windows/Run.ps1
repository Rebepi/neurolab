$ErrorActionPreference = 'Stop'
$env:NEUROLAB_DATA_DIR = 'C:\NeuroLab\data'
$env:NEUROLAB_FRONTEND_DIR = 'C:\NeuroLab\frontend\dist'
$env:TF_NUM_INTRAOP_THREADS = '2'
$env:TF_NUM_INTEROP_THREADS = '1'
$env:OMP_NUM_THREADS = '2'
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:KERAS_HOME = 'C:\NeuroLab\data\.keras'
Set-Location -LiteralPath 'C:\NeuroLab\backend'
# Redirección nativa: los mensajes informativos de TensorFlow en stderr no deben
# convertirse en errores terminantes de Windows PowerShell 5.1.
$process = Start-Process -FilePath 'C:\NeuroLab\venv\Scripts\python.exe' -ArgumentList '-m uvicorn app.main:app --host 0.0.0.0 --port 80 --workers 1' -WorkingDirectory 'C:\NeuroLab\backend' -RedirectStandardOutput 'C:\NeuroLab\logs\app.log' -RedirectStandardError 'C:\NeuroLab\logs\app-error.log' -WindowStyle Hidden -Wait -PassThru
exit $process.ExitCode
