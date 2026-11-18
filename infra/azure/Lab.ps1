#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Preflight','Plan','Deploy','Status','Start','Stop','Connections','UpdateAccess')]
    [string]$Action,
    [string]$ConfigPath = "$PSScriptRoot/lab.local.json",
    [string]$WindowsCredentialPath
)
$ErrorActionPreference = 'Stop'

function Invoke-AzureJson {
    param([string[]]$Arguments)
    $result = & az @Arguments --only-show-errors --output json
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI falló: $($Arguments[0..1] -join ' ')" }
    if ($result) { ($result -join "`n") | ConvertFrom-Json -Depth 100 }
}

function Assert-OperatorCidr {
    param([string]$Cidr)
    $ip = [System.Net.IPAddress]::None
    if ($Cidr -notmatch '^(.+)/32$' -or
        -not [System.Net.IPAddress]::TryParse(($Cidr -split '/')[0], [ref]$ip) -or
        $ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
        $ip.Equals([System.Net.IPAddress]::Any)) { throw 'operatorCidr debe ser una IPv4 válida /32.' }
}

. "$PSScriptRoot/AzureCli.ps1"
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$subscriptionGuid = [guid]::Empty
if (-not [guid]::TryParse($config.subscriptionId, [ref]$subscriptionGuid)) { throw 'Configura subscriptionId.' }
if ($config.prefix -cnotmatch '^[a-z][a-z0-9-]{2,15}$') { throw 'prefix: 3 a 16 caracteres, minúsculas, dígitos y guiones.' }
if ($config.resourceGroup -notmatch '^[a-zA-Z0-9_-]{3,80}$') { throw 'resourceGroup inválido.' }
$account = Invoke-AzureJson -Arguments @('account','show')
if ($account.id -ne $config.subscriptionId) {
    throw "Selecciona explícitamente tu suscripción educativa: az account set --subscription $($config.subscriptionId)"
}
Write-Host "Suscripción: $($account.name) / $($account.id)"
$base = @('--subscription', $config.subscriptionId, '--resource-group', $config.resourceGroup)
$names = @("$($config.prefix)-win", "$($config.prefix)-alma")

if ($Action -eq 'Preflight') {
    Invoke-AzureJson -Arguments @('policy','assignment','list','--subscription',$config.subscriptionId) |
        Select-Object displayName, parameters
    Invoke-AzureJson -Arguments @('vm','list-skus','--location',$config.location,'--size',$config.vmSize,'--all','--subscription',$config.subscriptionId) |
        Select-Object name, restrictions
    Invoke-AzureJson -Arguments @('vm','list-usage','--location',$config.location,'--subscription',$config.subscriptionId) |
        Where-Object { $_.name.value -eq 'cores' -or $_.name.value -like 'standardB*Family' } |
        Select-Object @{n='quota';e={$_.name.value}}, currentValue, limit
    Invoke-AzureJson -Arguments @('vm','image','show','--location',$config.location,'--urn',"almalinux:almalinux-x86_64:$($config.almaSku):latest",'--subscription',$config.subscriptionId) |
        Select-Object name, plan
    exit
}
if ($Action -eq 'UpdateAccess') {
    Assert-OperatorCidr $config.operatorCidr
    foreach ($name in $names) {
        foreach ($rule in @('OperatorManagement','OperatorDemoWeb')) {
            $null = Invoke-AzureJson -Arguments (@('network','nsg','rule','update') + $base + @('--nsg-name',"$name-nsg",'--name',$rule,'--source-address-prefixes',$config.operatorCidr))
        }
    }
    Write-Host 'Acceso actualizado al /32 configurado, sin encender VM.'
    return
}
if ($Action -in @('Plan','Deploy')) {
    Assert-OperatorCidr $config.operatorCidr
    if ($config.shutdownTime -notmatch '^([01][0-9]|2[0-3])[0-5][0-9]$') { throw 'shutdownTime debe ser HHmm UTC.' }
    $keyPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($config.sshPublicKeyPath)
    $key = (Get-Content -LiteralPath $keyPath -Raw).Trim()
    if ($key -notmatch '^ssh-(rsa|ed25519) ') { throw 'Usa un archivo de clave PÚBLICA SSH válido.' }
    $password = if ($WindowsCredentialPath) {
        (Import-Clixml -LiteralPath $WindowsCredentialPath).Password
    } else {
        Read-Host 'Contraseña de administrador Windows (no se guardará en Git)' -AsSecureString
    }
    $parameters = @{
        location = @{ value = $config.location }
        prefix = @{ value = $config.prefix }
        operatorCidr = @{ value = $config.operatorCidr }
        adminUsername = @{ value = $config.adminUsername }
        sshPublicKey = @{ value = $key }
        vmSize = @{ value = $config.vmSize }
        almaSku = @{ value = $config.almaSku }
        shutdownTime = @{ value = $config.shutdownTime }
        windowsAdminPassword = @{ value = [System.Net.NetworkCredential]::new('', $password).Password }
    }
    # Solo el proceso del usuario puede leer el archivo temporal de parámetros.
    $tempPath = Join-Path ([IO.Path]::GetTempPath()) ("neurolab-" + [guid]::NewGuid() + '.json')
    try {
        [IO.File]::WriteAllText($tempPath, '')
        if ($IsWindows) {
            $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            & icacls $tempPath /inheritance:r /grant:r "*${sid}:(F)" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'No se pudo proteger el archivo de parámetros.' }
        } else { & chmod 600 $tempPath; if ($LASTEXITCODE) { throw 'No se pudo proteger el archivo.' } }
        @{ parameters = $parameters } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $tempPath
        $exists = Invoke-AzureJson -Arguments @('group','exists','--name',$config.resourceGroup,'--subscription',$config.subscriptionId)
        if (-not $exists) {
            if ($Action -eq 'Plan') { throw 'Plan requiere un grupo existente. Crea primero el grupo vacío (sin VM) según docs/AZURE.md.' }
            $null = Invoke-AzureJson -Arguments @('group','create','--name',$config.resourceGroup,'--location',$config.location,'--subscription',$config.subscriptionId)
        }
        $verb = if ($Action -eq 'Plan') { 'what-if' } else { 'create' }
        $deployArgs = @('deployment','group',$verb) + $base + @('--name','neurolab-lab','--template-file',"$PSScriptRoot/main.bicep",'--parameters',"@$tempPath")
        if ($Action -eq 'Plan') { Invoke-AzureJson -Arguments ($deployArgs + @('--no-pretty-print')) }
        else {
            # Incluso si ARM falla parcialmente, intentar desasignar las VM creadas.
            try { Invoke-AzureJson -Arguments $deployArgs | Select-Object name, @{n='state';e={$_.properties.provisioningState}} }
            finally {
                foreach ($name in $names) {
                    & az vm deallocate @base --name $name --only-show-errors
                    if ($LASTEXITCODE -ne 0) { Write-Warning "No se pudo desasignar $name. Verifica en el portal." }
                }
            }
        }
    } finally {
        $parameters.Clear()
        if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
    }
    exit
}
if ($Action -in @('Start','Stop')) {
    $verb = if ($Action -eq 'Start') { 'start' } else { 'deallocate' }
    $failures = @()
    foreach ($name in $names) {
        & az vm $verb @base --name $name --only-show-errors
        if ($LASTEXITCODE -ne 0) { $failures += $name }
    }
    if ($failures.Count) { throw "Falló $Action en: $($failures -join ', '). Comprueba el portal." }
}
if ($Action -eq 'Connections') {
    $publicIps = Invoke-AzureJson -Arguments (@('network','public-ip','list') + $base)
    foreach ($name in $names) {
        $entry = $publicIps | Where-Object name -eq "$name-ip"
        [pscustomobject]@{ VM=$name; IP=$entry.ipAddress; DNS=$entry.dnsSettings.fqdn; Web="http://$($entry.dnsSettings.fqdn)" }
    }
} else {
    foreach ($name in $names) {
        $vm = Invoke-AzureJson -Arguments (@('vm','get-instance-view') + $base + @('--name',$name))
        [pscustomobject]@{ VM=$name; State=($vm.instanceView.statuses.code | Where-Object { $_ -like 'PowerState/*' }) }
    }
}
