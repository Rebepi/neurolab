#Requires -Version 7.0
[CmdletBinding()]
param([switch]$SkipFrontendBuild)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/..").Path
if (-not $SkipFrontendBuild) {
    Push-Location "$root/frontend"
    try {
        & npm ci --no-audit --no-fund
        if ($LASTEXITCODE) { throw 'Falló npm ci.' }
        & npm run build
        if ($LASTEXITCODE) { throw 'Falló el build.' }
    } finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath "$root/frontend/dist/index.html")) { throw 'Falta el build del frontend.' }
$package = Join-Path $PSScriptRoot 'package'
$staging = Join-Path $package ("staging-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path "$staging/backend/app","$staging/frontend","$staging/deploy" | Out-Null
# Solo fuentes Python: no trasladar __pycache__, bases ni modelos generados.
Get-ChildItem -LiteralPath "$root/backend/app" -File -Recurse -Filter *.py | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath("$root/backend/app", $_.FullName)
    $destination = Join-Path "$staging/backend/app" $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination
}
Copy-Item -LiteralPath "$root/backend/requirements.txt" -Destination "$staging/backend"
Copy-Item -LiteralPath "$root/frontend/dist" -Destination "$staging/frontend" -Recurse
Copy-Item -LiteralPath "$PSScriptRoot/linux","$PSScriptRoot/windows" -Destination "$staging/deploy" -Recurse
# Lista explícita: no se incluyen .env, claves, Git, node_modules ni datos locales.
$archive = Join-Path $package 'neurolab.zip'
Compress-Archive -Path "$staging/backend","$staging/frontend","$staging/deploy" -DestinationPath $archive -Force
# Eliminar exclusivamente el staging recién creado y comprobado bajo package/.
$resolvedPackage = (Resolve-Path -LiteralPath $package).Path.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$resolvedStaging = (Resolve-Path -LiteralPath $staging).Path
if (-not $resolvedStaging.StartsWith($resolvedPackage, [StringComparison]::OrdinalIgnoreCase)) { throw 'Staging fuera de package; no se eliminará.' }
Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
Get-FileHash -Algorithm SHA256 -LiteralPath $archive
Write-Host "Paquete: $archive"
