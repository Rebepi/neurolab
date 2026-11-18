#Requires -Version 7.0
# Transfiere el paquete privado por Blob + SAS de lectura de una hora.
# Usa Azure Run Command: no requiere abrir SSH en Windows ni guardar claves en GitHub.
[CmdletBinding()]
param(
    [ValidateSet('Windows','Alma','Both')][string]$Target = 'Both',
    [string]$ConfigPath = "$PSScriptRoot/../infra/azure/lab.local.json"
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../infra/azure/AzureCli.ps1"
function Invoke-AzureJson {
    param([string[]]$Arguments)
    $result = & az @Arguments --only-show-errors --output json
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI falló: $($Arguments[0..1] -join ' ')" }
    if ($result) { ($result -join "`n") | ConvertFrom-Json -Depth 100 }
}
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$account = Invoke-AzureJson -Arguments @('account','show')
if ($account.id -ne $config.subscriptionId) { throw 'Selecciona la suscripción del laboratorio antes de publicar.' }
$archive = Join-Path $PSScriptRoot 'package/neurolab.zip'
if (-not (Test-Path -LiteralPath $archive)) { throw 'Ejecuta deploy/Package.ps1 primero.' }
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
$servers = @()
if ($Target -in @('Windows','Both')) { $servers += @{name="$($config.prefix)-win"; os='Windows'} }
if ($Target -in @('Alma','Both')) { $servers += @{name="$($config.prefix)-alma"; os='Alma'} }
$base = @('--subscription',$config.subscriptionId,'--resource-group',$config.resourceGroup)
foreach ($server in $servers) {
    $vm = Invoke-AzureJson -Arguments (@('vm','get-instance-view') + $base + @('--name',$server.name))
    if ('PowerState/running' -notin $vm.instanceView.statuses.code) { throw "$($server.name) no está encendida. No se encenderá automáticamente." }
}
$identityHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($config.subscriptionId + $config.resourceGroup))).Substring(0,12).ToLowerInvariant()
$storageName = "stneurolab$identityHash"
$storageAccounts = Invoke-AzureJson -Arguments (@('storage','account','list') + $base)
if (-not ($storageAccounts | Where-Object name -eq $storageName)) {
    $null = Invoke-AzureJson -Arguments (@('storage','account','create') + $base + @('--name',$storageName,'--location',$config.location,'--sku','Standard_LRS','--kind','StorageV2','--https-only','true','--min-tls-version','TLS1_2','--allow-blob-public-access','false'))
}
$keys = Invoke-AzureJson -Arguments (@('storage','account','keys','list') + $base + @('--account-name',$storageName))
$previousKey = $env:AZURE_STORAGE_KEY
$env:AZURE_STORAGE_KEY = $keys[0].value
$blobName = "neurolab-$([guid]::NewGuid().ToString('N')).zip"
$scriptPath = $null
$uploaded = $false
try {
    $null = Invoke-AzureJson -Arguments @('storage','container','create','--account-name',$storageName,'--name','releases','--public-access','off')
    $null = Invoke-AzureJson -Arguments @('storage','blob','upload','--account-name',$storageName,'--container-name','releases','--name',$blobName,'--file',$archive)
    $uploaded = $true
    $expiry = [DateTime]::UtcNow.AddHours(1).ToString('yyyy-MM-ddTHH:mmZ')
    $sas = Invoke-AzureJson -Arguments @('storage','blob','generate-sas','--account-name',$storageName,'--container-name','releases','--name',$blobName,'--permissions','r','--expiry',$expiry,'--https-only')
    $downloadUrl = "https://$storageName.blob.core.windows.net/releases/$blobName`?$sas"
    foreach ($server in $servers) {
        Write-Host "Instalando en $($server.name); el servidor ya está encendido."
        if ($server.os -eq 'Windows') {
            $commandId = 'RunPowerShellScript'
            $script = @'
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$release = Join-Path 'C:\NeuroLabReleases' ([guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $release | Out-Null
$zip = Join-Path $release 'neurolab.zip'
Invoke-WebRequest -UseBasicParsing -Uri '__URL__' -OutFile $zip
if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne '__HASH__') { throw 'Checksum incorrecto.' }
Expand-Archive -LiteralPath $zip -DestinationPath $release
function Install-SignedExe($Url, $FileName, $Signer, $Arguments) {
    $file = Join-Path $release $FileName
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $file
    $signature = Get-AuthenticodeSignature -LiteralPath $file
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notlike "*$Signer*") { throw 'Firma de instalador inválida.' }
    $process = Start-Process -FilePath $file -ArgumentList $Arguments -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -notin @(0,3010)) { throw "Falló $FileName ($($process.ExitCode))" }
}
$python = 'C:\Program Files\Python311\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    Install-SignedExe 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' 'python.exe' 'Python Software Foundation' '/quiet InstallAllUsers=1 TargetDir="C:\Program Files\Python311" Include_launcher=0 Include_test=0 PrependPath=0'
}
$vcRuntime = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64' -ErrorAction SilentlyContinue
if (-not $vcRuntime -or $vcRuntime.Installed -ne 1) {
    Install-SignedExe 'https://aka.ms/vs/17/release/vc_redist.x64.exe' 'vc_redist.exe' 'Microsoft Corporation' '/install /quiet /norestart'
}
& "$release\deploy\windows\Install.ps1" -PythonPath $python
Write-Output 'NEUROLAB_DEPLOY_OK'
'@
        } else {
            $commandId = 'RunShellScript'
            $script = @'
#!/usr/bin/env bash
set -euo pipefail
dnf install -y curl unzip
release_dir="$(mktemp -d /tmp/neurolab-release.XXXXXXXX)"
trap 'rm -rf -- "$release_dir"' EXIT
curl --fail --silent --show-error --location '__URL__' --output "$release_dir/neurolab.zip"
echo '__HASH__  '"$release_dir/neurolab.zip" | sha256sum --check -
unzip -q "$release_dir/neurolab.zip" -d "$release_dir"
bash "$release_dir/deploy/linux/install.sh"
echo NEUROLAB_DEPLOY_OK
'@
        }
        $script = $script.Replace('__URL__',$downloadUrl).Replace('__HASH__',$hash)
        $scriptPath = Join-Path ([IO.Path]::GetTempPath()) ("neurolab-publish-$([guid]::NewGuid()).txt")
        [IO.File]::WriteAllText($scriptPath,'')
        if ($IsWindows) {
            $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            & icacls $scriptPath /inheritance:r /grant:r "*${sid}:(F)" | Out-Null
            if ($LASTEXITCODE) { throw 'No se pudo proteger el script temporal.' }
        } else { & chmod 600 $scriptPath; if ($LASTEXITCODE) { throw 'No se pudo proteger el script temporal.' } }
        [IO.File]::WriteAllText($scriptPath,$script.Replace("`r`n","`n"))
        $response = Invoke-AzureJson -Arguments (@('vm','run-command','invoke') + $base + @('--name',$server.name,'--command-id',$commandId,'--scripts',"@$scriptPath"))
        $messages = $response.value.message -join "`n"
        if ($messages -notmatch 'NEUROLAB_DEPLOY_OK') {
            # No imprimir el script ni el SAS. La salida remota puede incluir errores de descarga.
            $messages = $messages.Replace($downloadUrl,'[URL temporal oculta]').Replace($sas,'[SAS oculto]')
            throw "La instalación falló en $($server.name):`n$messages"
        }
        Write-Host "$($server.name): instalación y health local correctos."
        Remove-Item -LiteralPath $scriptPath -Force
        $scriptPath = $null
    }
} finally {
    if ($uploaded) {
        & az storage blob delete --account-name $storageName --container-name releases --name $blobName --only-show-errors --output none
        if ($LASTEXITCODE) { Write-Warning 'No se pudo retirar el paquete temporal del almacenamiento.' }
    }
    $env:AZURE_STORAGE_KEY = $previousKey
    if ($scriptPath -and (Test-Path -LiteralPath $scriptPath)) { Remove-Item -LiteralPath $scriptPath -Force }
}
Write-Host 'Publicación finalizada. Al terminar las pruebas, ejecutar Lab.ps1 -Action Stop.'
