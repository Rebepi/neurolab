#Requires -Version 5.1
#Requires -RunAsAdministrator
[CmdletBinding()]
param([string]$PythonPath = 'C:\Program Files\Python311\python.exe')
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path "$PSScriptRoot\..\..").Path
$target = 'C:\NeuroLab'
if (-not (Test-Path -LiteralPath $PythonPath)) { throw 'Instala Python 3.11 para todos los usuarios y especifica -PythonPath.' }
if (-not (Test-Path -LiteralPath "$source\frontend\dist\index.html")) { throw 'Primero compila frontend/dist.' }

$version = & $PythonPath --version
if ($LASTEXITCODE -ne 0 -or $version -notmatch '^Python 3\.11\.') { throw 'Este despliegue se valida con Python 3.11.' }
if (Get-ScheduledTask -TaskName NeuroLab -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName NeuroLab
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-ScheduledTask -TaskName NeuroLab).State -eq 'Running') {
        if ((Get-Date) -gt $deadline) { throw 'La tarea anterior no se detuvo; no se actualizarán archivos en uso.' }
        Start-Sleep -Seconds 1
    }
}
New-Item -ItemType Directory -Force -Path "$target\backend","$target\frontend","$target\data","$target\logs" | Out-Null
Copy-Item -LiteralPath "$source\backend\app" -Destination "$target\backend" -Recurse -Force
Copy-Item -LiteralPath "$source\backend\requirements.txt" -Destination "$target\backend" -Force
Copy-Item -LiteralPath "$source\frontend\dist" -Destination "$target\frontend" -Recurse -Force
Copy-Item -LiteralPath "$PSScriptRoot\Run.ps1" -Destination "$target\Run.ps1" -Force
& $PythonPath -m venv "$target\venv"
if ($LASTEXITCODE) { throw 'No se pudo crear el entorno virtual.' }
& "$target\venv\Scripts\python.exe" -m pip install --upgrade pip
if ($LASTEXITCODE) { throw 'No se pudo instalar pip.' }
& "$target\venv\Scripts\python.exe" -m pip install -r "$target\backend\requirements.txt"
if ($LASTEXITCODE) { throw 'No se pudieron instalar las dependencias del backend.' }

# LOCAL SERVICE puede escribir datos/logs, pero no modificar el código instalado.
& icacls $target /grant '*S-1-5-19:(OI)(CI)RX' | Out-Null
if ($LASTEXITCODE) { throw 'No se pudo asignar lectura al servicio.' }
foreach ($directory in @("$target\data", "$target\logs")) {
    & icacls $directory /grant '*S-1-5-19:(OI)(CI)M' | Out-Null
    if ($LASTEXITCODE) { throw 'No se pudo asignar escritura al servicio.' }
}
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\NeuroLab\Run.ps1' -WorkingDirectory "$target\backend"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-19' -LogonType ServiceAccount
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName NeuroLab -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
if (-not (Get-NetFirewallRule -Name NeuroLabHTTP -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name NeuroLabHTTP -DisplayName 'NeuroLab HTTP demo (NSG restricted)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 | Out-Null
}
Start-ScheduledTask -TaskName NeuroLab
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try { Invoke-RestMethod http://127.0.0.1/health -TimeoutSec 3; return }
    catch { Start-Sleep -Seconds 3 }
}
Get-ScheduledTaskInfo -TaskName NeuroLab | Format-List LastRunTime,LastTaskResult
if (Test-Path -LiteralPath "$target\logs\app-error.log") { Get-Content -LiteralPath "$target\logs\app-error.log" -Tail 40 }
throw "El servicio no respondió. Revisa $target\logs\app.log y la tarea NeuroLab."
