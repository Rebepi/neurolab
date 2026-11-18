#Requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$Train,
    [switch]$ExistingModel,
    [switch]$SkipRemoteAccess,
    [ValidateSet('Windows','Alma','Both')][string]$Target = 'Both',
    [string]$ConfigPath = "$PSScriptRoot/../infra/azure/lab.local.json"
)
$ErrorActionPreference = 'Stop'
$connections = @(& "$PSScriptRoot/../infra/azure/Lab.ps1" -Action Connections -ConfigPath $ConfigPath)
foreach ($server in $connections) {
    if ($Target -eq 'Windows' -and $server.VM -notlike '*-win') { continue }
    if ($Target -eq 'Alma' -and $server.VM -notlike '*-alma') { continue }
    $resolved = @(Resolve-DnsName -Name $server.DNS -Type A | Where-Object Type -eq A | Select-Object -ExpandProperty IPAddress)
    if ($server.IP -notin $resolved) { throw "DNS no coincide con la IP de $($server.VM)." }
    $health = $null
    $readyDeadline = (Get-Date).AddMinutes(2)
    do {
        try { $health = Invoke-RestMethod -Uri "$($server.Web)/health" -TimeoutSec 5 }
        catch { $health = $null }
        if ($health -and $health.status -eq 'healthy') { break }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $readyDeadline)
    if (-not $health -or $health.status -ne 'healthy') { throw "$($server.VM) no está lista; comprobar estado de VM y servicio." }
    $ipHealth = Invoke-RestMethod -Uri "http://$($server.IP)/health" -TimeoutSec 20
    $frontendResponse = Invoke-WebRequest -Uri $server.Web -TimeoutSec 20
    if ($health.status -ne 'healthy' -or $ipHealth.status -ne 'healthy' -or $frontendResponse.Content -notmatch '<div id="root">') {
        throw "Falló health o el frontend en $($server.VM)."
    }
    # Solo cuentas/datos académicos: las credenciales de demostración ya son públicas en el código.
    $login = Invoke-RestMethod -Uri "$($server.Web)/api/v1/auth/login" -Method Post -ContentType application/json -Body '{"email":"admin@neurolab.io","password":"admin123"}' -TimeoutSec 20
    if (-not $login.user.id) { throw "Falló login en $($server.VM)." }
    $remoteAccess = 'not-requested'
    if (-not $SkipRemoteAccess) {
        if ($server.VM -like '*-win') {
            $client = [Net.Sockets.TcpClient]::new()
            try {
                if (-not $client.ConnectAsync($server.DNS,3389).Wait(10000) -or -not $client.Connected) { throw 'El puerto RDP no responde.' }
                $remoteAccess = 'RDP-port-open'
            } finally { $client.Dispose() }
        } else {
            $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
            $publicKeyPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($config.sshPublicKeyPath)
            if (-not $publicKeyPath.EndsWith('.pub')) { throw 'La ruta SSH pública debe terminar en .pub.' }
            $privateKeyPath = $publicKeyPath.Substring(0,$publicKeyPath.Length - 4)
            if (-not (Test-Path -LiteralPath $privateKeyPath)) { throw 'Falta la clave privada para comprobar SSH; usar -SkipRemoteAccess solo si se desea verificar la web.' }
            # Obtener la clave del host por el canal autenticado de Azure, antes de confiar en SSH.
            $raw = & az vm run-command invoke --subscription $config.subscriptionId --resource-group $config.resourceGroup --name $server.VM --command-id RunShellScript --scripts 'cat /etc/ssh/ssh_host_ed25519_key.pub' --only-show-errors --output json
            if ($LASTEXITCODE) { throw 'No se pudo obtener la clave de host por Azure.' }
            $command = ($raw -join "`n") | ConvertFrom-Json
            $match = [regex]::Match(($command.value.message -join "`n"),'(?m)^ssh-ed25519 [A-Za-z0-9+/=]+')
            if (-not $match.Success) { throw 'Azure no devolvió una clave de host válida.' }
            $knownHosts = Join-Path (Split-Path $privateKeyPath) 'known_hosts_neurolab'
            $record = "$($server.DNS),$($server.IP) $($match.Value)"
            $existing = if (Test-Path -LiteralPath $knownHosts) { @(Get-Content -LiteralPath $knownHosts) } else { @() }
            $hostRecords = @($existing | Where-Object { $_.StartsWith("$($server.DNS),") })
            if ($hostRecords.Count -and $record -notin $hostRecords) { throw 'La clave SSH del host cambió. Verificar la rotación antes de actualizar known_hosts_neurolab.' }
            if (-not $hostRecords.Count) { Add-Content -LiteralPath $knownHosts -Value $record -Encoding utf8 }
            $hostFileOption = 'UserKnownHostsFile="' + $knownHosts.Replace('\','/') + '"'
            $sshOutput = & ssh -i $privateKeyPath -o $hostFileOption -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=10 "$($config.adminUsername)@$($server.DNS)" 'hostname && systemctl is-active neurolab'
            if ($LASTEXITCODE -ne 0) { throw 'Falló la autenticación SSH o el servicio en AlmaLinux.' }
            $remoteAccess = 'SSH-authenticated'
        }
    }
    $training = 'not-requested'
    $jobId = $null
    $modelId = $null
    if ($Train) {
        $body = @{architecture_id='arch-mlp-demo';dataset_id='ds-churn-demo';hyperparams=@{epochs=1;batch_size=128}} | ConvertTo-Json -Depth 5
        $queued = Invoke-RestMethod -Uri "$($server.Web)/api/v1/projects/prj-churn-demo/training-jobs" -Method Post -ContentType application/json -Body $body -TimeoutSec 20
        $jobId = $queued.job_id
        $deadline = (Get-Date).AddMinutes(3)
        do {
            Start-Sleep -Seconds 2
            $job = Invoke-RestMethod -Uri "$($server.Web)/api/v1/training-jobs/$jobId" -TimeoutSec 20
        } while ($job.status -notin @('COMPLETED','FAILED','CANCELLED') -and (Get-Date) -lt $deadline)
        if ($job.status -ne 'COMPLETED') { throw "Entrenamiento fallido en $($server.VM): $($job | ConvertTo-Json -Compress -Depth 5)" }
        if (-not $job.model_version.id) { throw 'El modelo no quedó registrado.' }
        $modelId = $job.model_version.id
        $model = Invoke-RestMethod -Uri "$($server.Web)/api/v1/models/$modelId" -TimeoutSec 20
        if ($model.job_id -ne $jobId) { throw 'El modelo no corresponde al entrenamiento.' }
        $training = $job.status
    }
    if ($ExistingModel) {
        $overview = Invoke-RestMethod -Uri "$($server.Web)/api/v1/dashboard/overview" -TimeoutSec 20
        $candidate = $overview.recent_jobs | Where-Object status -eq 'COMPLETED' | Select-Object -First 1
        if (-not $candidate) { throw 'No hay un entrenamiento completado para comprobar persistencia.' }
        $jobId = $candidate.id
        $job = Invoke-RestMethod -Uri "$($server.Web)/api/v1/training-jobs/$jobId" -TimeoutSec 20
        if (-not $job.model_version.id) { throw 'No se conservó el registro del modelo.' }
        $modelId = $job.model_version.id
        $model = Invoke-RestMethod -Uri "$($server.Web)/api/v1/models/$modelId" -TimeoutSec 20
        if ($model.job_id -ne $jobId) { throw 'El modelo no corresponde al trabajo persistente.' }
        $training = 'COMPLETED-persisted'
    }
    $modelBytes = $null
    if ($modelId) {
        $binary = Invoke-WebRequest -Uri "$($server.Web)/api/v1/models/$modelId/download" -TimeoutSec 20
        if ($binary.StatusCode -ne 200 -or $binary.RawContentLength -le 0) { throw 'El binario del modelo no está disponible.' }
        $modelBytes = $binary.RawContentLength
    }
    [pscustomobject]@{VM=$server.VM;IP=$server.IP;DNS=$server.DNS;Frontend=$frontendResponse.StatusCode;HealthDNS=$health.status;HealthIP=$ipHealth.status;Login='OK';RemoteAccess=$remoteAccess;Training=$training;Job=$jobId;Model=$modelId;ModelBytes=$modelBytes}
}
