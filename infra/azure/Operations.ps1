# Funciones para operar el laboratorio existente. No crean VM ni asignan roles.
function Invoke-NeuroAzure {
    param([string[]]$Arguments)
    $result = & az @Arguments --only-show-errors --output json
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI falló ($($Arguments[0..1] -join ' ')). Revisa sesión y permisos del grupo rg-neurolab-demo." }
    if ($result) { ConvertFrom-Json -InputObject ($result -join "`n") -Depth 100 }
}

function Get-NeuroPublicCidr {
    param([string]$IpPublica)
    $address = $IpPublica
    if (-not $address) {
        foreach ($uri in @('https://api.ipify.org','https://ipv4.icanhazip.com')) {
            try { $address = ([string](Invoke-RestMethod -Uri $uri -TimeoutSec 15)).Trim(); break }
            catch { $address = $null }
        }
    }
    $parsedIp = [Net.IPAddress]::None
    if (-not [Net.IPAddress]::TryParse($address,[ref]$parsedIp) -or
        $parsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or
        $parsedIp.Equals([Net.IPAddress]::Any)) {
        throw 'No se pudo determinar una IPv4 válida. Reintenta o usa -IpPublica TU-IP-PUBLICA (sin /32).'
    }
    return "$parsedIp/32"
}

function Get-NeuroProfile {
    param([string]$RepositoryRoot)
    $manifest = Get-Content -LiteralPath "$RepositoryRoot/infra/azure/lab.manifest.json" -Raw | ConvertFrom-Json
    $path = "$RepositoryRoot/infra/azure/lab.local.json"
    if (Test-Path -LiteralPath $path) {
        $operatorProfile = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        if ($operatorProfile.subscriptionId -ne $manifest.subscriptionId -or $operatorProfile.resourceGroup -ne $manifest.resourceGroup -or $operatorProfile.prefix -ne $manifest.prefix) {
            throw 'El perfil local apunta a otro laboratorio. Revisar lab.local.json; no se cambiará ni se operará otra suscripción.'
        }
    } else {
        $operatorProfile = [ordered]@{}
        foreach ($name in @('subscriptionId','resourceGroup','location','prefix','adminUsername','sshPublicKeyPath','vmSize','almaSku','shutdownTime')) {
            $operatorProfile[$name] = $manifest.$name
        }
        $operatorProfile['operatorCidr'] = '127.0.0.1/32' # Solo marcador local; no se envía a Azure.
        $operatorProfile = [pscustomobject]$operatorProfile
    }
    if (-not $operatorProfile.operatorId) {
        $identity = [Environment]::MachineName + ':' + [Environment]::UserName
        $hash = [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($identity))
        $operatorProfile | Add-Member operatorId ([Convert]::ToHexString($hash).Substring(0,12).ToLowerInvariant())
    }
    return [pscustomobject]@{Config=$operatorProfile;Path=$path;Manifest=$manifest}
}

function Save-NeuroProfile {
    param($OperatorProfile)
    $OperatorProfile.Config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OperatorProfile.Path -Encoding utf8
}

function Connect-NeuroAccount {
    param([string]$SubscriptionId,[string]$TenantId)
    $raw = & az account show --only-show-errors --output json 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Completa el inicio de sesión de Microsoft Azure CLI con tu propia cuenta. No pegues contraseñas ni MFA en el chat.'
        & az login --tenant $TenantId --use-device-code --output none
        if ($LASTEXITCODE -ne 0) { throw 'No se completó el inicio de sesión de Azure.' }
    }
    & az account set --subscription $SubscriptionId --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw 'Tu cuenta no tiene acceso a la suscripción del proyecto. El propietario debe concederlo una vez; consultar MANUAL_SERVIDORES.md.' }
    $account = Invoke-NeuroAzure -Arguments @('account','show')
    if ($account.id -ne $SubscriptionId) { throw 'La suscripción activa no coincide con el proyecto.' }
    Write-Host "Cuenta Azure lista. Suscripción: $($account.name)."
}

function Get-NeuroAccessPriority {
    param([object[]]$Rules,[string]$RuleName)
    $ownRule = $Rules | Where-Object name -eq $RuleName | Select-Object -First 1
    if ($ownRule) { return [int]$ownRule.priority }
    $used = @($Rules | ForEach-Object { [int]$_.priority })
    foreach ($priority in 200..499) { if ($priority -notin $used) { return $priority } }
    throw 'No hay prioridades de acceso personal libres (200 a 499). Revisar reglas del laboratorio.'
}

function Set-NeuroPersonalAccess {
    param($OperatorProfile,[string]$IpPublica)
    $config = $OperatorProfile.Config
    $cidr = Get-NeuroPublicCidr -IpPublica $IpPublica
    $ruleName = "neurolab-device-$($config.operatorId)"
    foreach ($suffix in @('win','alma')) {
        $nsg = "$($config.prefix)-$suffix-nsg"
        $base = @('--subscription',$config.subscriptionId,'--resource-group',$config.resourceGroup,'--nsg-name',$nsg)
        $rules = @(Invoke-NeuroAzure -Arguments (@('network','nsg','rule','list') + $base))
        $priority = Get-NeuroAccessPriority -Rules $rules -RuleName $ruleName
        $ports = if ($suffix -eq 'win') { @('80','3389') } else { @('80','22') }
        $null = Invoke-NeuroAzure -Arguments (@('network','nsg','rule','create') + $base + @(
            '--name',$ruleName,'--priority',"$priority",'--direction','Inbound','--access','Allow',
            '--protocol','Tcp','--source-address-prefixes',$cidr,'--source-port-ranges','*',
            '--destination-address-prefixes','*','--destination-port-ranges'
        ) + $ports + @('--description','NeuroLab workstation access; one public IPv4 only'))
    }
    $config.operatorCidr = $cidr
    Save-NeuroProfile $OperatorProfile
    Write-Host "Acceso de este equipo actualizado a $cidr. Regla: $ruleName. Las reglas de otros equipos se conservan."
}
