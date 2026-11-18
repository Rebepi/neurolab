targetScope = 'resourceGroup'

param location string = resourceGroup().location
@minLength(3)
@maxLength(16)
param prefix string = 'neurolab'
@description('IPv4 pública del operador con máscara /32. Nunca usar acceso global.')
param operatorCidr string
param adminUsername string = 'neurolabadmin'
@secure()
param windowsAdminPassword string
param sshPublicKey string
param vmSize string = 'Standard_B2als_v2'
@description('Verificar disponibilidad y términos de la imagen oficial antes de crear.')
param almaSku string = '9-gen2'
@description('Hora UTC. 03:00 UTC equivale a 22:00 del día anterior en Lima.')
param shutdownTime string = '0300'

var tags = { project: 'NeuroLab', purpose: 'student-demo', owner: 'cloud-team' }
var servers = [
  { name: '${prefix}-win', os: 'Windows', subnet: 'windows', address: '10.42.1.0/24', ports: ['3389'] }
  { name: '${prefix}-alma', os: 'Linux', subnet: 'alma', address: '10.42.2.0/24', ports: ['22'] }
]

resource nsgs 'Microsoft.Network/networkSecurityGroups@2024-05-01' = [for server in servers: {
  name: '${server.name}-nsg'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'OperatorManagement'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRanges: server.ports
          sourceAddressPrefix: operatorCidr
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'OperatorDemoWeb'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRange: '80'
          sourceAddressPrefix: operatorCidr
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'DenyOtherInbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
}]

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${prefix}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.42.0.0/16'] }
    subnets: [for (server, i) in servers: {
      name: server.subnet
      properties: {
        addressPrefix: server.address
        networkSecurityGroup: { id: nsgs[i].id }
        // Salida explícita mediante la IP pública de cada NIC.
        defaultOutboundAccess: false
      }
    }]
  }
}

resource ips 'Microsoft.Network/publicIPAddresses@2024-05-01' = [for server in servers: {
  name: '${server.name}-ip'
  location: location
  tags: tags
  sku: { name: 'Standard' }
  properties: {
    publicIPAllocationMethod: 'Static'
    publicIPAddressVersion: 'IPv4'
    dnsSettings: { domainNameLabel: '${server.name}-${uniqueString(resourceGroup().id)}' }
  }
}]

resource nics 'Microsoft.Network/networkInterfaces@2024-05-01' = [for (server, i) in servers: {
  name: '${server.name}-nic'
  location: location
  tags: tags
  properties: {
    ipConfigurations: [{
      name: 'primary'
      properties: {
        privateIPAllocationMethod: 'Dynamic'
        subnet: { id: resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, server.subnet) }
        publicIPAddress: { id: ips[i].id }
      }
    }]
  }
}]

resource vms 'Microsoft.Compute/virtualMachines@2024-07-01' = [for (server, i) in servers: {
  name: server.name
  location: location
  tags: tags
  properties: {
    hardwareProfile: { vmSize: vmSize }
    storageProfile: {
      imageReference: server.os == 'Windows' ? {
        publisher: 'MicrosoftWindowsServer'
        offer: 'WindowsServer'
        sku: '2022-datacenter-g2'
        version: 'latest'
      } : {
        publisher: 'almalinux'
        offer: 'almalinux-x86_64'
        sku: almaSku
        version: 'latest'
      }
      osDisk: {
        createOption: 'FromImage'
        managedDisk: { storageAccountType: 'Standard_LRS' }
        deleteOption: 'Delete'
      }
    }
    osProfile: server.os == 'Windows' ? {
      computerName: 'neurolab-win'
      adminUsername: adminUsername
      adminPassword: windowsAdminPassword
      windowsConfiguration: { provisionVMAgent: true, enableAutomaticUpdates: true }
    } : {
      computerName: 'neurolab-alma'
      adminUsername: adminUsername
      linuxConfiguration: {
        disablePasswordAuthentication: true
        provisionVMAgent: true
        ssh: {
          publicKeys: [{ path: '/home/${adminUsername}/.ssh/authorized_keys', keyData: sshPublicKey }]
        }
      }
    }
    networkProfile: {
      networkInterfaces: [{ id: nics[i].id, properties: { primary: true, deleteOption: 'Delete' } }]
    }
    diagnosticsProfile: { bootDiagnostics: { enabled: true } }
  }
}]

resource shutdowns 'Microsoft.DevTestLab/schedules@2018-09-15' = [for (server, i) in servers: {
  name: 'shutdown-computevm-${server.name}'
  location: location
  tags: tags
  properties: {
    status: 'Enabled'
    taskType: 'ComputeVmShutdownTask'
    dailyRecurrence: { time: shutdownTime }
    timeZoneId: 'UTC'
    notificationSettings: { status: 'Disabled', timeInMinutes: 30 }
    targetResourceId: vms[i].id
  }
}]

output connections array = [for (server, i) in servers: {
  name: server.name
  os: server.os
  ip: ips[i].properties.ipAddress
  dns: ips[i].properties.dnsSettings.fqdn
}]
