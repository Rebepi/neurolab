# Resolver la instalación estándar también en una terminal abierta antes de instalar Azure CLI.
if (-not (Get-Command az -ErrorAction SilentlyContinue) -and $IsWindows) {
    foreach ($baseDirectory in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $baseDirectory) { continue }
        $candidate = Join-Path $baseDirectory 'Microsoft SDKs/Azure/CLI2/wbin/az.cmd'
        if (Test-Path -LiteralPath $candidate) {
            $env:Path = (Split-Path $candidate) + [IO.Path]::PathSeparator + $env:Path
            break
        }
    }
}
if (-not (Get-Command az -ErrorAction SilentlyContinue)) { throw 'Instala Azure CLI y abre otra terminal.' }
