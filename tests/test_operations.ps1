# Pruebas sin Azure, sin red y sin credenciales: reglas por operador y validación IP.
#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../infra/azure/Operations.ps1"

function Assert-True {
    param([bool]$Condition,[string]$Message)
    if (-not $Condition) { throw $Message }
}

Assert-True ((Get-NeuroPublicCidr -IpPublica '203.0.113.42') -eq '203.0.113.42/32') 'Debe restringir la IPv4 a un /32.'
foreach ($invalid in @('0.0.0.0','::1','not-an-ip','203.0.113.42/24')) {
    $rejected = $false
    try { $null = Get-NeuroPublicCidr -IpPublica $invalid }
    catch { $rejected = $true }
    Assert-True $rejected "Se aceptó una dirección inválida: $invalid"
}

$rules = @(@{name='friend-device';priority=200},@{name='my-device';priority=207})
Assert-True ((Get-NeuroAccessPriority -Rules $rules -RuleName 'my-device') -eq 207) 'No debe cambiar la prioridad de una regla propia existente.'
Assert-True ((Get-NeuroAccessPriority -Rules $rules -RuleName 'new-device') -eq 201) 'Debe buscar una prioridad libre sin ocupar la del compañero.'

# Simular un clon nuevo: crear perfil sin una clave privada, sin autenticarse y sin red.
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('neurolab-ops-tests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path "$fixtureRoot/infra/azure" | Out-Null
Copy-Item -LiteralPath "$PSScriptRoot/../infra/azure/lab.manifest.json" -Destination "$fixtureRoot/infra/azure/lab.manifest.json"
try {
    $fresh = Get-NeuroProfile -RepositoryRoot $fixtureRoot
    Assert-True ($fresh.Config.resourceGroup -eq 'rg-neurolab-demo') 'El clon nuevo debe descubrir el grupo sin preguntar.'
    Assert-True ($fresh.Config.operatorId -match '^[0-9a-f]{12}$') 'Debe asignar un identificador estable por equipo.'
    Assert-True ($fresh.Config.sshPublicKeyPath -eq '~/.ssh/neurolab_azure.pub') 'No debe copiar la ruta privada del equipo original.'
    Save-NeuroProfile $fresh
    $loaded = Get-NeuroProfile -RepositoryRoot $fixtureRoot
    Assert-True ($loaded.Config.operatorId -eq $fresh.Config.operatorId) 'Debe conservar la identidad del operador al reabrir.'
} finally {
    $resolvedFixture = (Resolve-Path -LiteralPath $fixtureRoot).Path
    $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $resolvedFixture.StartsWith($resolvedTemp,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolvedFixture -Leaf) -notlike 'neurolab-ops-tests-*') { throw 'Fixture fuera del directorio temporal; no se eliminará.' }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}

$script:recordedCalls = [Collections.Generic.List[object]]::new()
$script:savedProfile = $false
function Invoke-NeuroAzure {
    param([string[]]$Arguments)
    $script:recordedCalls.Add($Arguments)
    if ($Arguments[3] -eq 'list') {
        if ($Arguments -contains 'neurolab-win-nsg') {
            return @(@{name='friend-device';priority=200},@{name='neurolab-device-test';priority=207})
        }
        return @(@{name='friend-device';priority=200})
    }
    return @{name='neurolab-device-test'}
}
function Save-NeuroProfile {
    param($OperatorProfile)
    $script:savedProfile = $true
}
$fakeProfile = [pscustomobject]@{Config=[pscustomobject]@{
    subscriptionId='test';resourceGroup='rg-neurolab-demo';prefix='neurolab';operatorId='test';operatorCidr='127.0.0.1/32'
}}
Set-NeuroPersonalAccess -OperatorProfile $fakeProfile -IpPublica '203.0.113.42'
$writes = @($script:recordedCalls | Where-Object { $_[3] -eq 'create' })
Assert-True ($writes.Count -eq 2) 'Debe gestionar una regla por NSG, no cambiar reglas compartidas.'
foreach ($arguments in $writes) {
    Assert-True ($arguments -contains 'neurolab-device-test') 'Solo debe crear/actualizar la regla de este operador.'
    Assert-True ($arguments -contains '203.0.113.42/32') 'La fuente debe ser la IP exacta del operador.'
    Assert-True (-not ($arguments -contains '0.0.0.0/0')) 'No debe abrir acceso global.'
    Assert-True (-not ($arguments -contains 'friend-device')) 'No debe modificar la regla del compañero.'
    $priority = $arguments[([array]::IndexOf($arguments,'--priority') + 1)]
    if ($arguments -contains 'neurolab-win-nsg') {
        Assert-True ($priority -eq '207') 'Debe conservar la prioridad Windows existente.'
        Assert-True (($arguments -contains '3389') -and -not ($arguments -contains '22')) 'Windows solo debe abrir HTTP/RDP.'
    } else {
        Assert-True ($priority -eq '201') 'Debe evitar la prioridad ya usada por el compañero.'
        Assert-True (($arguments -contains '22') -and -not ($arguments -contains '3389')) 'AlmaLinux solo debe abrir HTTP/SSH.'
    }
}
Assert-True $script:savedProfile 'Debe guardar el perfil después de actualizar las reglas.'
Assert-True ($fakeProfile.Config.operatorCidr -eq '203.0.113.42/32') 'El perfil debe recordar la última IP.'
Write-Output 'Operación sin Azure: validación IP, prioridades y conservación del acceso del compañero OK.'
