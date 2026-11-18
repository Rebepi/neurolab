#Requires -Version 7.2
# Formato: cabecera autenticada + nonce (12) + tag (16) + ciphertext.
function Protect-NeuroBackup {
    param([byte[]]$Plaintext,[byte[]]$Key)
    if ($Key.Length -ne 32) { throw 'El respaldo requiere una clave AES de 256 bits.' }
    $header = [Text.Encoding]::ASCII.GetBytes("NEUROLAB-AES256GCM-V1`n")
    $nonce = [Security.Cryptography.RandomNumberGenerator]::GetBytes(12)
    $tag = [byte[]]::new(16)
    $ciphertext = [byte[]]::new($Plaintext.Length)
    $aes = [Security.Cryptography.AesGcm]::new($Key)
    try { $aes.Encrypt($nonce,$Plaintext,$ciphertext,$tag,$header) }
    finally { $aes.Dispose() }
    $sealedBytes = [byte[]]::new($header.Length + 12 + 16 + $ciphertext.Length)
    [Buffer]::BlockCopy($header,0,$sealedBytes,0,$header.Length)
    [Buffer]::BlockCopy($nonce,0,$sealedBytes,$header.Length,12)
    [Buffer]::BlockCopy($tag,0,$sealedBytes,$header.Length + 12,16)
    [Buffer]::BlockCopy($ciphertext,0,$sealedBytes,$header.Length + 28,$ciphertext.Length)
    return ,$sealedBytes
}

function Unprotect-NeuroBackup {
    param([byte[]]$SealedBytes,[byte[]]$Key)
    $header = [Text.Encoding]::ASCII.GetBytes("NEUROLAB-AES256GCM-V1`n")
    if ($Key.Length -ne 32 -or $SealedBytes.Length -lt ($header.Length + 28)) { throw 'Formato o clave de respaldo inválidos.' }
    if ([Text.Encoding]::ASCII.GetString($SealedBytes,0,$header.Length) -cne [Text.Encoding]::ASCII.GetString($header)) { throw 'Versión de respaldo desconocida.' }
    $nonce = [byte[]]::new(12)
    $tag = [byte[]]::new(16)
    $ciphertext = [byte[]]::new($SealedBytes.Length - $header.Length - 28)
    [Buffer]::BlockCopy($SealedBytes,$header.Length,$nonce,0,12)
    [Buffer]::BlockCopy($SealedBytes,$header.Length + 12,$tag,0,16)
    [Buffer]::BlockCopy($SealedBytes,$header.Length + 28,$ciphertext,0,$ciphertext.Length)
    $plaintext = [byte[]]::new($ciphertext.Length)
    $aes = [Security.Cryptography.AesGcm]::new($Key)
    try { $aes.Decrypt($nonce,$ciphertext,$tag,$plaintext,$header) }
    finally { $aes.Dispose() }
    return ,$plaintext
}

function Set-NeuroPrivateFileAccess {
    param([string]$Path)
    if (-not $IsWindows) { throw 'Las credenciales DPAPI de este respaldo se administran en Windows.' }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    & icacls $Path /inheritance:r /grant:r "*${sid}:(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron restringir los permisos del archivo privado.' }
}
