#Requires -Version 7.2
[CmdletBinding()]
param(
    [string]$PrivateTextPath,
    [string]$ArchivePath = "$PSScriptRoot/private-backup/neurolab-credentials.enc"
)
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'Exportar desde el usuario Windows que puede descifrar la credencial DPAPI original.' }
. "$PSScriptRoot/BackupCrypto.ps1"
$repositoryRoot = (Resolve-Path "$PSScriptRoot/../..").Path
$manifest = Get-Content -LiteralPath "$PSScriptRoot/lab.manifest.json" -Raw | ConvertFrom-Json
$credentialPath = Join-Path $env:USERPROFILE '.azure/neurolab-windows.credential.xml'
$keyPath = Join-Path $env:USERPROFILE '.ssh/neurolab_azure'
$publicKeyPath = $keyPath + '.pub'
$knownHostsPath = Join-Path $env:USERPROFILE '.ssh/known_hosts_neurolab'
foreach ($required in @($credentialPath,$keyPath,$publicKeyPath)) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Falta un archivo necesario: $required" }
}
if (Test-Path -LiteralPath $ArchivePath) { throw 'Ese respaldo cifrado ya existe. Elige otro -ArchivePath para conservar las copias anteriores.' }
if (-not $PrivateTextPath) {
    $downloads = (Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders' -Name '{374DE290-123F-4565-9164-39C4925E467B}').'{374DE290-123F-4565-9164-39C4925E467B}'
    $PrivateTextPath = Join-Path ([Environment]::ExpandEnvironmentVariables($downloads)) 'NEUROLAB_ACCESOS_PRIVADOS.txt'
}
if (Test-Path -LiteralPath $PrivateTextPath) { throw 'El TXT privado ya existe. Elige otro -PrivateTextPath; no se sobrescribirá.' }
$privateFullPath = [IO.Path]::GetFullPath($PrivateTextPath)
$repoPrefix = $repositoryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if ($privateFullPath.StartsWith($repoPrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Guarda el TXT privado fuera del repositorio, por ejemplo en Descargas.' }
$windowsCredential = Import-Clixml -LiteralPath $credentialPath
$windowsPassword = $windowsCredential.GetNetworkCredential().Password
$privateKey = Get-Content -LiteralPath $keyPath -Raw
$publicKey = (Get-Content -LiteralPath $publicKeyPath -Raw).Trim()
$hostKeys = if (Test-Path -LiteralPath $knownHostsPath) { Get-Content -LiteralPath $knownHostsPath -Raw } else { '' }
$localConfigPath = "$PSScriptRoot/lab.local.json"
$localConfig = if (Test-Path -LiteralPath $localConfigPath) { Get-Content -LiteralPath $localConfigPath -Raw | ConvertFrom-Json } else { $null }
$createdUtc = [DateTimeOffset]::UtcNow.ToString('o')
$createdLima = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTimeOffset]::UtcNow,'SA Pacific Standard Time').ToString('yyyy-MM-dd HH:mm:ss zzz')
$instructions = @"
NEUROLAB - ACCESOS PRIVADOS Y RECUPERACION
CONFIDENCIAL: este TXT contiene la contraseña RDP y la clave privada SSH completas.
No subir este TXT ni su clave de descifrado a GitHub, chats, capturas ni tickets.
Conserva otra copia en un gestor de contraseñas o almacenamiento cifrado bajo tu control.
Creado en Lima: $createdLima
Marca técnica UTC: $createdUtc

1. SERVIDORES Y CUENTA AZURE
Grupo: $($manifest.resourceGroup)
Suscripción: $($manifest.subscriptionId)
Directorio/tenant: $($manifest.tenantId)
Windows DNS: $($manifest.servers[0].dns)
Windows IP: $($manifest.servers[0].ip)
AlmaLinux DNS: $($manifest.servers[1].dns)
AlmaLinux IP: $($manifest.servers[1].ip)
La contraseña de la cuenta Microsoft y los códigos MFA NO se generaron ni se guardaron en el proyecto.
En otro equipo: instalar PowerShell 7 y Azure CLI, clonar el repositorio y ejecutar ./servidores.ps1 preparar.
Cada persona debe iniciar sesión con su propia cuenta autorizada en Azure.
No copiar cachés de sesión de .azure ni tokens de GitHub: no se necesitan para recuperar estas VM.

2. WINDOWS SERVER / ESCRITORIO REMOTO
Usuario RDP: neurolab-win\$($manifest.adminUsername)
WINDOWS_RDP_PASSWORD=$windowsPassword
Origen protegido con DPAPI: $credentialPath
Destino estándar en otro Windows: %USERPROFILE%\.azure\neurolab-windows.credential.xml
No basta con copiar el XML DPAPI original: está ligado al equipo y usuario originales.
Restore-PrivateBackup.ps1 recrea el XML cifrado para el usuario del nuevo equipo con la contraseña de este respaldo.
La contraseña RDP NO va en .env y NO hace falta para Azure Run Command.

3. SSH ALMALINUX
Usuario: $($manifest.adminUsername)
Archivo privado destino: %USERPROFILE%\.ssh\neurolab_azure
Archivo público destino: %USERPROFILE%\.ssh\neurolab_azure.pub
Hosts verificados destino: %USERPROFILE%\.ssh\known_hosts_neurolab
Si se copia a mano, guardar solo el bloque OpenSSH en el archivo privado, con sus saltos de línea y sin BOM.
La clave privada NO va en .env ni en variables VITE_*.
Esta es la clave del propietario del laboratorio. Para tu amigo, preferir su cuenta Azure y una clave propia.

INICIO CLAVE PRIVADA SSH - copiar incluyendo BEGIN y END:
$privateKey
FIN CLAVE PRIVADA SSH

CLAVE PUBLICA SSH:
$publicKey

HOSTS VERIFICADOS:
$hostKeys

4. CUENTAS INICIALES DE LA APLICACION (DEMO)
Estas claves ya eran públicas en el código y NO son credenciales de Azure/RDP/SSH.
Administrador: admin@neurolab.io / admin123
Responsable: lead@neurolab.io / lead123
Ingeniero: engineer@neurolab.io / eng123
Revisor: reviewer@neurolab.io / rev123
Lector: viewer@neurolab.io / view123
Si luego se cambian en la aplicación, este respaldo no conoce automáticamente las contraseñas nuevas.

5. DONDE VA CADA COSA / .ENV
La instalación actual NO necesita un .env para ninguna contraseña ni clave.
El backend lee os.environ y no carga automáticamente archivos .env (no se instaló python-dotenv).
Windows ya configura sus variables en C:\NeuroLab\Run.ps1.
AlmaLinux ya configura sus variables en /etc/systemd/system/neurolab.service.

Windows:
  NEUROLAB_DATA_DIR=C:\NeuroLab\data
  NEUROLAB_FRONTEND_DIR=C:\NeuroLab\frontend\dist
  KERAS_HOME=C:\NeuroLab\data\.keras
AlmaLinux:
  NEUROLAB_DATA_DIR=/var/lib/neurolab
  NEUROLAB_FRONTEND_DIR=/opt/neurolab/frontend/dist
  KERAS_HOME=/var/lib/neurolab/.keras
Ambos:
  TF_NUM_INTRAOP_THREADS=2
  TF_NUM_INTEROP_THREADS=1
  OMP_NUM_THREADS=2
  PYTHONDONTWRITEBYTECODE=1

Si en el futuro se incorpora un cargador .env, usar backend/.env fuera de Git y cargarlo explícitamente.
No crear ahora un .env pensando que sustituye los scripts del servicio: no se leerá por sí solo.
Nunca poner secretos en frontend/.env con prefijo VITE_: se pueden incorporar al JavaScript público.
La clave AES del apartado 8 se conserva en este TXT privado, NO en .env del proyecto ni en GitHub Secrets para CI.

6. PERFIL LOCAL Y OTRAS CREDENCIALES
Perfil por equipo: <raíz-del-repo>\infra\azure\lab.local.json (excluido de Git).
Se genera con ./servidores.ps1 preparar. No copiar el operatorId de un compañero: cada equipo usa su regla.
Clave GitHub/PAT: no se necesita en .env. Para hacer push desde otra PC, usar gh auth login o el inicio normal de Git.
Claves de Azure Storage: Publish.ps1 las obtiene con la sesión Azure, las usa temporalmente y restaura el entorno.
No hace falta guardar una clave de Storage permanente en .env ni en este TXT.
Cloudflare: el despliegue Azure no lo usa. No se generó ni existe aquí un token Cloudflare que respaldar.
Los .bat antiguos, si se usaran aparte, buscan .cloudflare-token en la raíz o CLOUDFLARE_TUNNEL_TOKEN en el entorno;
ese token tendría que suministrarlo el propietario del túnel. No es necesario para nuestros servidores Azure.

7. USO DIARIO
./servidores.ps1 conectar
./servidores.ps1 probar
./servidores.ps1 apagar
Al apagar deben quedar AMBAS en PowerState/deallocated.
Autoapagado de respaldo: 22:00 de Lima. Discos e IP pueden seguir consumiendo crédito.
Restaurar este respaldo no enciende VM, no cambia contraseñas remotas ni concede roles Azure a otra persona.

8. RESPALDO CIFRADO PUBLICABLE
Archivo del repositorio: infra/azure/private-backup/neurolab-credentials.enc
Archivo cifrado de esta exportación: $([IO.Path]::GetFullPath($ArchivePath))
Cifrado: AES-256-GCM, clave aleatoria de 32 bytes; no es una contraseña corta inventada.
El archivo .enc puede estar en el repositorio público; esta clave y este TXT deben permanecer privados.
En otra PC, clonar el repo y ejecutar, indicando la ubicación privada real de este TXT:
  ./infra/azure/Restore-PrivateBackup.ps1 -PrivateTextPath "RUTA-PRIVADA-A-ESTE-TXT"
Para comprobar el respaldo sin escribir credenciales:
  ./infra/azure/Restore-PrivateBackup.ps1 -PrivateTextPath "RUTA-PRIVADA-A-ESTE-TXT" -ValidateOnly
La restauración no sobrescribe credenciales diferentes que ya existan en el equipo.
Después ejecutar ./servidores.ps1 preparar e iniciar sesión con tu propia cuenta Azure.
Si pierdes este TXT y no conservas la clave AES, el archivo cifrado por sí solo no se puede abrir.
Si cambias RDP o claves SSH en el futuro, generar un respaldo nuevo con rutas nuevas; el anterior no se actualiza solo.
Si elegiste otro nombre con -ArchivePath al exportar, pasar ese mismo archivo al restaurador con -ArchivePath.
"@
$payload = @{
    schema='neurolab-private-backup-v1';createdUtc=$createdUtc;manifest=$manifest
    windowsUsername=$manifest.adminUsername;windowsPassword=$windowsPassword
    sshPrivateKey=$privateKey;sshPublicKey=$publicKey;sshKnownHosts=$hostKeys
    originalLocalConfig=$localConfig;privateInstructions=$instructions
} | ConvertTo-Json -Depth 20
$plainBytes = [Text.Encoding]::UTF8.GetBytes($payload)
$key = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$sealedBytes = Protect-NeuroBackup -Plaintext $plainBytes -Key $key
$roundtrip = [Text.Encoding]::UTF8.GetString((Unprotect-NeuroBackup -SealedBytes $sealedBytes -Key $key)) | ConvertFrom-Json
if ($roundtrip.windowsPassword -cne $windowsPassword -or $roundtrip.sshPrivateKey -cne $privateKey) { throw 'El respaldo no pasó la verificación de integridad.' }
New-Item -ItemType Directory -Force -Path (Split-Path $ArchivePath),(Split-Path $privateFullPath) | Out-Null
[IO.File]::WriteAllText($privateFullPath,'')
Set-NeuroPrivateFileAccess -Path $privateFullPath
$keyText = [Convert]::ToBase64String($key)
$privateText = $instructions + "`r`nNEUROLAB_BACKUP_KEY_BASE64=$keyText`r`n"
[IO.File]::WriteAllText($privateFullPath,$privateText,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllBytes([IO.Path]::GetFullPath($ArchivePath),$sealedBytes)
$digest = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash
[IO.File]::AppendAllText($privateFullPath,"SHA256_ARCHIVO_CIFRADO=$digest`r`n",[Text.UTF8Encoding]::new($false))
[Array]::Clear($plainBytes,0,$plainBytes.Length)
[Array]::Clear($key,0,$key.Length)
[pscustomobject]@{PrivateText=$privateFullPath;EncryptedArchive=[IO.Path]::GetFullPath($ArchivePath);SHA256=$digest;IntegrityCheck='OK'}
