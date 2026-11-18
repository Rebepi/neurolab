#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [ValidateSet('ayuda','preparar','conectar','estado','apagar','accesos','probar','probar-apagar','desplegar','diagnostico')]
    [string]$Accion = 'ayuda',
    [string]$IpPublica,
    [switch]$Entrenar,
    [switch]$ModeloExistente
)
$ErrorActionPreference = 'Stop'
$repositoryRoot = $PSScriptRoot
if ($Accion -eq 'ayuda') {
    Write-Output @'
NeuroLab: operar las VM existentes (PowerShell 7, desde el proyecto).
  ./servidores.ps1 preparar        Cuenta y perfil local; no enciende ni abre puertos.
  ./servidores.ps1 conectar        Actualiza tu IP /32, enciende ambas VM y comprueba la web.
  ./servidores.ps1 estado          Consulta estados; no enciende VM.
  ./servidores.ps1 accesos         Muestra IP, DNS y URL reales.
  ./servidores.ps1 probar          Comprueba web/login de las VM ya encendidas.
  ./servidores.ps1 probar -Entrenar              Entrenamiento sintético de una época.
  ./servidores.ps1 probar -ModeloExistente       Comprueba un modelo anterior.
  ./servidores.ps1 probar-apagar   Conecta, prueba y desasigna ambas incluso ante fallos.
  ./servidores.ps1 desplegar       Compila/publica en VM ya encendidas; conserva sus datos.
  ./servidores.ps1 diagnostico    Estado y logs remotos; no enciende VM.
  ./servidores.ps1 apagar         Desasigna ambas VM y verifica el estado final.
Manual: MANUAL_SERVIDORES.md. Instrucciones IA: AGENTS.md y docs/AGENTES_NUBE.md.
No hace falta una clave SSH ni contraseña RDP para las operaciones con Azure CLI.
'@
    return
}
. "$repositoryRoot/infra/azure/AzureCli.ps1"
. "$repositoryRoot/infra/azure/Operations.ps1"
$operatorProfile = Get-NeuroProfile -RepositoryRoot $repositoryRoot
Connect-NeuroAccount -SubscriptionId $operatorProfile.Config.subscriptionId -TenantId $operatorProfile.Manifest.tenantId
Save-NeuroProfile $operatorProfile

function Invoke-ProjectLab {
    param([string]$Action)
    & "$repositoryRoot/infra/azure/Lab.ps1" -Action $Action -ConfigPath $operatorProfile.Path
}
function Test-ProjectWeb {
    $options = @{ConfigPath=$operatorProfile.Path;SkipRemoteAccess=$true}
    if ($Entrenar) { $options.Train = $true }
    if ($ModeloExistente) { $options.ExistingModel = $true }
    & "$repositoryRoot/deploy/Verify.ps1" @options
}
function Start-ProjectSession {
    Set-NeuroPersonalAccess -OperatorProfile $operatorProfile -IpPublica $IpPublica
    Invoke-ProjectLab Start
    Test-ProjectWeb
    Invoke-ProjectLab Connections | Format-Table VM,IP,DNS,Web -AutoSize
    Write-Host 'Sesión abierta: las dos VM quedan encendidas. Al terminar: ./servidores.ps1 apagar. Respaldo diario: 22:00 de Lima.'
}

switch ($Accion) {
    preparar { Write-Host 'Perfil local preparado. Para abrir una sesión: ./servidores.ps1 conectar' }
    conectar {
        $previousStates = @(Invoke-ProjectLab Status)
        try { Start-ProjectSession }
        catch {
            Write-Warning 'No se pudo abrir la sesión completa; se intentará desasignar solo las VM que no estaban ya encendidas.'
            foreach ($state in $previousStates) {
                if ($state.State -eq 'PowerState/running') { continue }
                & az vm deallocate --subscription $operatorProfile.Config.subscriptionId --resource-group $operatorProfile.Config.resourceGroup --name $state.VM --only-show-errors
                if ($LASTEXITCODE) { Write-Warning "No se pudo desasignar $($state.VM); revisar Azure Portal." }
            }
            throw
        }
    }
    estado { Invoke-ProjectLab Status }
    accesos { Invoke-ProjectLab Connections | Format-Table VM,IP,DNS,Web -AutoSize }
    apagar {
        Invoke-ProjectLab Stop
        $states = @(Invoke-ProjectLab Status)
        $states
        if ($states.Count -ne 2 -or @($states | Where-Object State -ne 'PowerState/deallocated').Count) {
            throw 'No se confirmó la desasignación de ambas VM. Comprobar el portal antes de cerrar la sesión.'
        }
    }
    probar { Test-ProjectWeb }
    'probar-apagar' {
        try { Start-ProjectSession }
        finally { Invoke-ProjectLab Stop }
    }
    desplegar {
        $states = @(Invoke-ProjectLab Status)
        if ($states.Count -ne 2 -or @($states | Where-Object State -ne 'PowerState/running').Count) {
            throw 'Despliegue requiere ambas VM encendidas. Usa conectar para abrir una sesión primero.'
        }
        & "$repositoryRoot/deploy/Package.ps1"
        & "$repositoryRoot/deploy/Publish.ps1" -Target Both -ConfigPath $operatorProfile.Path
        Test-ProjectWeb
        Write-Host 'Despliegue comprobado. Las VM siguen encendidas para la sesión; al terminar usa apagar.'
    }
    diagnostico {
        $states = @(Invoke-ProjectLab Status)
        $states | Format-Table
        foreach ($state in $states) {
            if ($state.State -ne 'PowerState/running') { Write-Host "$($state.VM): desasignada o no disponible; no se encenderá para leer logs."; continue }
            if ($state.VM -like '*-win') {
                $commandId = 'RunPowerShellScript'
                $script = 'Get-ScheduledTask -TaskName NeuroLab | Select-Object TaskName,State; Get-ScheduledTaskInfo -TaskName NeuroLab | Select-Object LastTaskResult,LastRunTime; Get-Content C:\NeuroLab\logs\app-error.log -Tail 40 -ErrorAction SilentlyContinue'
            } else {
                $commandId = 'RunShellScript'
                $script = 'systemctl status neurolab --no-pager; journalctl -u neurolab --no-pager -n 40'
            }
            $response = Invoke-NeuroAzure -Arguments @('vm','run-command','invoke','--subscription',$operatorProfile.Config.subscriptionId,'--resource-group',$operatorProfile.Config.resourceGroup,'--name',$state.VM,'--command-id',$commandId,'--scripts',$script)
            Write-Host "--- $($state.VM) ---"
            $response.value.message
        }
    }
}
