#Requires -Version 7.2
# Datos sintéticos solamente: no lee credenciales del usuario ni accede a Azure.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../infra/azure/BackupCrypto.ps1"
$key = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$plaintext = [Text.Encoding]::UTF8.GetBytes('synthetic backup: no real credentials')
$sealedBytes = Protect-NeuroBackup -Plaintext $plaintext -Key $key
$decoded = Unprotect-NeuroBackup -SealedBytes $sealedBytes -Key $key
if ([Text.Encoding]::UTF8.GetString($decoded) -cne [Text.Encoding]::UTF8.GetString($plaintext)) { throw 'El contenido no se recuperó exactamente.' }
if ([Text.Encoding]::UTF8.GetString($sealedBytes).Contains('no real credentials')) { throw 'El archivo expuso el texto original.' }

function Assert-Rejected {
    param([scriptblock]$Operation)
    $rejected = $false
    try { $null = & $Operation }
    catch { $rejected = $true }
    if (-not $rejected) { throw 'Se aceptó una clave incorrecta o un archivo alterado.' }
}
$otherKey = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
Assert-Rejected { Unprotect-NeuroBackup -SealedBytes $sealedBytes -Key $otherKey }
$modified = [byte[]]$sealedBytes.Clone()
$modified[$modified.Length - 1] = $modified[$modified.Length - 1] -bxor 1
Assert-Rejected { Unprotect-NeuroBackup -SealedBytes $modified -Key $key }
$modifiedHeader = [byte[]]$sealedBytes.Clone()
$modifiedHeader[0] = $modifiedHeader[0] -bxor 1
Assert-Rejected { Unprotect-NeuroBackup -SealedBytes $modifiedHeader -Key $key }
Assert-Rejected { Unprotect-NeuroBackup -SealedBytes ([byte[]]::new(2)) -Key $key }
Assert-Rejected { Protect-NeuroBackup -Plaintext $plaintext -Key ([byte[]]::new(16)) }
Write-Output 'Respaldo AES-256-GCM: recuperación exacta y rechazo de clave incorrecta, alteraciones y truncamiento OK.'
