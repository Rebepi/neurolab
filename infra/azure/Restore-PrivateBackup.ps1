#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PrivateTextPath,
    [string]$ArchivePath = "$PSScriptRoot/private-backup/neurolab-credentials.enc",
    [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/BackupCrypto.ps1"
$privateText = Get-Content -LiteralPath $PrivateTextPath -Raw
$match = [regex]::Match($privateText,'(?m)^NEUROLAB_BACKUP_KEY_BASE64=([A-Za-z0-9+/=]+)\r?$')
if (-not $match.Success) { throw 'El TXT no contiene la clave del respaldo. No pegues la clave en el chat.' }
$key = [Convert]::FromBase64String($match.Groups[1].Value)
$sealedBytes = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $ArchivePath).Path)
try { $plaintext = Unprotect-NeuroBackup -SealedBytes $sealedBytes -Key $key }
catch { throw 'No se pudo autenticar el respaldo: clave incorrecta o archivo modificado.' }
finally { [Array]::Clear($key,0,$key.Length) }
$payload = [Text.Encoding]::UTF8.GetString($plaintext) | ConvertFrom-Json -Depth 30
[Array]::Clear($plaintext,0,$plaintext.Length)
if ($payload.schema -ne 'neurolab-private-backup-v1' -or -not $payload.windowsPassword -or -not $payload.sshPrivateKey -or -not $payload.sshPublicKey) { throw 'Contenido de respaldo incompleto o desconocido.' }
if ($ValidateOnly) {
    [pscustomobject]@{IntegrityCheck='OK';WindowsCredentialIncluded=$true;SshKeyIncluded=$true;CreatedUtc=$payload.createdUtc;FilesRestored=$false}
    return
}
if (-not $IsWindows) { throw 'La restauración automática de credencial DPAPI está destinada a Windows. Puedes validar el respaldo sin restaurarlo.' }
$sshDirectory = Join-Path $env:USERPROFILE '.ssh'
$azureDirectory = Join-Path $env:USERPROFILE '.azure'
$files = [ordered]@{
    (Join-Path $sshDirectory 'neurolab_azure') = $payload.sshPrivateKey
    (Join-Path $sshDirectory 'neurolab_azure.pub') = $payload.sshPublicKey + "`n"
    (Join-Path $sshDirectory 'known_hosts_neurolab') = $payload.sshKnownHosts
}
# Validar todos los destinos antes de escribir. Nunca reemplazar una clave diferente.
foreach ($path in $files.Keys) {
    if ((Test-Path -LiteralPath $path) -and (Get-Content -LiteralPath $path -Raw).TrimEnd() -cne ([string]$files[$path]).TrimEnd()) {
        throw "Ya existe un archivo diferente en $path. Se conservará; restaurar con cuidado en un perfil propio."
    }
}
$credentialPath = Join-Path $azureDirectory 'neurolab-windows.credential.xml'
if (Test-Path -LiteralPath $credentialPath) {
    $existing = Import-Clixml -LiteralPath $credentialPath
    if ($existing.UserName -cne $payload.windowsUsername -or $existing.GetNetworkCredential().Password -cne $payload.windowsPassword) {
        throw 'Ya hay otra credencial Windows local. No se sobrescribirá.'
    }
}
New-Item -ItemType Directory -Force -Path $sshDirectory,$azureDirectory | Out-Null
foreach ($path in $files.Keys) {
    if (-not (Test-Path -LiteralPath $path)) {
        [IO.File]::WriteAllText($path,'')
        Set-NeuroPrivateFileAccess -Path $path
        [IO.File]::WriteAllText($path,[string]$files[$path],[Text.UTF8Encoding]::new($false))
    }
}
if (-not (Test-Path -LiteralPath $credentialPath)) {
    [IO.File]::WriteAllText($credentialPath,'')
    Set-NeuroPrivateFileAccess -Path $credentialPath
    $password = ConvertTo-SecureString $payload.windowsPassword -AsPlainText -Force
    [PSCredential]::new($payload.windowsUsername,$password) | Export-Clixml -LiteralPath $credentialPath
}
[pscustomobject]@{IntegrityCheck='OK';FilesRestored=$true;SshDirectory=$sshDirectory;WindowsCredential=$credentialPath;NextStep='./servidores.ps1 preparar'}
