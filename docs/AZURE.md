# NeuroLab en Azure: laboratorio académico

Para el uso diario desde casa, otra computadora o con el compañero, comenzar por [MANUAL_SERVIDORES.md](../MANUAL_SERVIDORES.md) y `servidores.ps1`. Esta página es la referencia técnica de bajo nivel. El wrapper genera el perfil desde el manifiesto y mantiene reglas `/32` propias por equipo.

## Qué se crea

Dos VM independientes, cada una con una instalación completa de NeuroLab y sus propios datos:

| Servidor | Sistema | Administración inicial | Aplicación |
|---|---|---|---|
| `neurolab-win` | Windows Server 2022 con escritorio | RDP y Azure Run Command | FastAPI + build de React |
| `neurolab-alma` | AlmaLinux 9, imagen oficial | SSH por clave y Azure Run Command | FastAPI + build de React |

No es un clúster: los usuarios, datasets y modelos creados en una VM no se copian a la otra.
Las VM, los discos HDD Standard LRS y las IP públicas Standard son recursos facturables. B2als v2 (2 vCPU/4 GiB) es una opción inicial para demostraciones pequeñas, no una garantía de capacidad para entrenamientos. Para entrenamiento más pesado evaluar 8 GiB y revisar el precio antes del cambio. No se contrata GPU, Bastion, balanceador, NAT Gateway ni dominio de pago.

## Qué significan los accesos del profesor

- **Escritorio remoto (RDP):** abre el escritorio de Windows Server mediante `mstsc`, puerto 3389.
- **IP pública:** dirección numérica del servidor, por ejemplo `203.0.113.10` (solo ejemplo).
- **Nombre DNS/FQDN:** nombre que resuelve a esa IP, asignado a cada IP pública por Azure: `<etiqueta>.<region>.cloudapp.azure.com`.
- **Dominio propio:** opcional. Si ya tienen uno, un CNAME como `win.ejemplo.com` puede apuntar al FQDN de Azure. No se debe reutilizar `neurolab.rebepi.com` sin coordinar con su propietario.
- **Servidor DNS:** un resolvedor como `168.63.129.16` en Azure no es la dirección de acceso web. Confirmar si el docente realmente pide DNS, IP o un dominio de Active Directory: son requisitos diferentes.

AlmaLinux también admite RDP mediante XRDP y un entorno gráfico. No se instala inicialmente porque incrementa el consumo de memoria y disco; se añadirá si lo exige la consigna. El DNS no sustituye RDP ni SSH: indica a qué equipo conectarse.

## Preparación y creación

Requisitos en el equipo operador: PowerShell 7, Azure CLI, OpenSSH, Node.js 24 y acceso a la suscripción educativa. No compartir la contraseña ni los códigos MFA.

```powershell
az login --use-device-code
az account list --query "[].{name:name,id:id,state:state}" -o table
az account set --subscription ID-DE-TU-SUSCRIPCION
Copy-Item infra/azure/lab.example.json infra/azure/lab.local.json
```

Editar `lab.local.json`: ID real de suscripción, región permitida, IP pública del operador con `/32`, ruta de clave pública y nombres. El ejemplo `westus2` es solo ilustrativo; las cuentas de estudiantes suelen tener políticas regionales. Revisar la política con:

```powershell
az policy assignment list --query "[].{name:displayName,parameters:parameters}" -o json
```

Generar una clave dedicada si aún no existe. Elegir una contraseña de clave cuando corresponda a su forma de trabajo; nunca sobrescribir una clave existente:

```powershell
ssh-keygen -t rsa -b 3072 -f "$env:USERPROFILE/.ssh/neurolab_azure"
```

El archivo `.pub` se instala en AlmaLinux; la clave privada permanece en el equipo. La contraseña de Windows se pide como SecureString. Opcionalmente `-WindowsCredentialPath` lee un `PSCredential` exportado con `Export-Clixml` (DPAPI en Windows, solo lo abre el mismo usuario/equipo); guardarlo fuera del repositorio y no usar este mecanismo en otros sistemas donde no ofrece la misma protección.

```powershell
./infra/azure/Lab.ps1 -Action Preflight
# Revisar región, restricciones SKU, cuota total y cuota familia B (se necesitan 4 vCPU).
# Si la imagen devuelve un plan, revisar sus términos antes de aceptarlos.
az group create --name rg-neurolab-demo --location REGION-PERMITIDA
./infra/azure/Lab.ps1 -Action Plan
./infra/azure/Lab.ps1 -Action Deploy
./infra/azure/Lab.ps1 -Action Status
```

`Plan` usa ARM what-if: muestra cambios, no calcula una factura. `Deploy` crea las VM y luego intenta desasignarlas, incluso ante un fallo parcial. Verificar siempre el estado final; un fallo de red puede impedir el apagado. La creación no instala todavía NeuroLab.

El administrador debe usar una contraseña fuerte que cumpla la política de Azure. No cambiar la suscripción a pago por uso ni retirar el límite de gasto para resolver restricciones del plan educativo.

En el laboratorio preparado desde este equipo, las credenciales de Windows se guardan en `%USERPROFILE%\.azure\neurolab-windows.credential.xml`, cifradas con DPAPI para tu usuario de Windows, y la clave SSH en `%USERPROFILE%\.ssh\neurolab_azure`. Para consultar la contraseña **solo en tu terminal local**, sin pegarla en el chat ni en Git:

```powershell
$cred = Import-Clixml "$env:USERPROFILE/.azure/neurolab-windows.credential.xml"
$cred.GetNetworkCredential().Password
```

Usar `neurolab-win\neurolabadmin` en RDP. El archivo DPAPI no se puede llevar a otro equipo/usuario y descifrar allí: respaldar la contraseña de manera segura antes de cambiar de equipo.

## Costos y ciclo de presentación

Azure for Students normalmente ofrece USD 100 durante 12 meses, sujeto a elegibilidad y condiciones. Eso no demuestra el saldo de esta cuenta: consultarlo en **Education Hub** o [Azure Sponsorships](https://www.microsoftazuresponsorships.com/).

Antes de crear, revisar [la calculadora](https://azure.microsoft.com/pricing/calculator/) para la región/tamaño y anotar: tarifa Linux/hora + Windows/hora + discos/mes + dos IPv4/mes + tráfico y transacciones. Las franquicias gratuitas pueden variar según la antigüedad de la suscripción. No asumir que ambas VM sean gratuitas.

```powershell
# Solo cuando se vaya a trabajar o presentar:
./infra/azure/Lab.ps1 -Action Start
./infra/azure/Lab.ps1 -Action Status
./infra/azure/Lab.ps1 -Action Connections

# Al terminar:
./infra/azure/Lab.ps1 -Action Stop
./infra/azure/Lab.ps1 -Action Status
```

El resultado requerido es `PowerState/deallocated` en las dos VM. Apagar desde Windows/Linux o detener únicamente NeuroLab no garantiza que deje de cobrarse cómputo.

Si cambia la red del operador (por ejemplo, de casa al instituto), actualizar `operatorCidr` en `lab.local.json` con la nueva IP pública `/32` y ejecutar `./infra/azure/Lab.ps1 -Action UpdateAccess`. Actualiza las reglas de administración y web de ambos NSG sin encender las VM ni pedir la contraseña Windows. No abrir `0.0.0.0/0` para resolver un bloqueo de acceso.

Hay apagado diario de respaldo a las `03:00 UTC` (22:00 en Lima). Si se encienden después de esa hora, el siguiente apagado será al día siguiente: usar `Stop` al terminar cada sesión. Si la presentación ocurre después de las 22:00, ajustar `shutdownTime` antes y volver a aplicar la infraestructura. No hay encendido programado.

**Desasignar conserva discos e IP públicas y puede seguir consumiendo crédito.** No existe costo cero garantizado con esta arquitectura persistente. Para pausas largas, evaluar respaldar/exportar y eliminar recursos; esta eliminación requiere una decisión expresa porque puede borrar la base y los modelos. Configurar un presupuesto mensual y alertas al 50/80/100% en Cost Management según el saldo disponible. Las alertas por sí solas no detienen servicios y pueden llegar con retraso.

## Instalar la aplicación

Compilar y empaquetar desde el equipo operador:

```powershell
./deploy/Package.ps1
```

El resultado es `deploy/package/neurolab.zip`, con backend, frontend compilado e instaladores. No incluye `.env`, Git, la base local, modelos ni claves. Mantenerlo fuera del control de versiones.

### Instalación automatizada desde este equipo

Con ambas VM ya encendidas y Azure CLI autenticado, el siguiente comando transfiere el paquete e instala sin necesidad de copiar archivos por RDP:

```powershell
./deploy/Publish.ps1 -Target Both
```

Utiliza Azure Run Command y una cuenta auxiliar Blob Standard LRS privada en el grupo del laboratorio. El ZIP se descarga por HTTPS con una URL SAS de solo lectura que vence en una hora, se verifica por SHA-256 y se elimina del Blob al terminar (también si falla la instalación). El script temporal local se protege y se elimina. La cuenta queda vacía; hay cargos pequeños de transacciones/almacenamiento durante la transferencia. El SAS puede quedar en el historial de Run Command hasta su vencimiento: no compartirlo. Este flujo usa temporalmente una clave de esa cuenta de almacenamiento dentro del proceso de publicación; no crea una identidad permanente para agentes ni claves en GitHub.

En Windows instala Python 3.11.9 x64 y Visual C++ Redistributable desde fuentes oficiales comprobando sus firmas. En AlmaLinux instala Python desde los repositorios del sistema. Si alguna descarga o instalación falla, el script informa el error y se debe detener las VM con `Stop`. No enciende servidores ni los apaga por sí solo; durante esta instalación el cómputo está activo. También se puede elegir `-Target Windows` o `-Target Alma`.

### Instalación manual alternativa

**Windows:** encender, entrar por RDP usando el DNS o la IP que entregue `Connections`, copiar el ZIP al servidor y extraerlo en una carpeta nueva. Instalar Python 3.11 x64 para todos los usuarios desde [python.org](https://www.python.org/downloads/windows/), incluyendo pip. Instalar [Microsoft Visual C++ Redistributable x64](https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist) si TensorFlow lo necesita. En PowerShell como administrador dentro del paquete extraído:

```powershell
./deploy/windows/Install.ps1 -PythonPath 'C:\Program Files\Python311\python.exe'
```

Se registra una tarea `NeuroLab` al iniciar Windows, bajo `LOCAL SERVICE`, con código en `C:\NeuroLab`, datos en `C:\NeuroLab\data` y logs en `C:\NeuroLab\logs\app.log` y `app-error.log` (se renuevan al iniciar el proceso). No usa la sesión RDP para mantener el servidor en funcionamiento. La tarea permite ejecutar únicamente su proceso PowerShell con `-ExecutionPolicy Bypass`; no modifica la política de ejecución del equipo. El código del paquete se verifica por checksum antes de instalarse.

**AlmaLinux:** verificar la huella SSH antes de aceptar el host por primera vez. Obtener la huella real mediante Azure Run Command:

```powershell
az vm run-command invoke -g rg-neurolab-demo -n neurolab-alma --command-id RunShellScript --scripts 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub' --query 'value[].message' -o tsv
scp -i "$env:USERPROFILE/.ssh/neurolab_azure" deploy/package/neurolab.zip neurolabadmin@DNS-ALMA:~/neurolab.zip
ssh -i "$env:USERPROFILE/.ssh/neurolab_azure" neurolabadmin@DNS-ALMA
```

Dentro de AlmaLinux:

```bash
sudo dnf install -y unzip
mkdir -p ~/neurolab-release
unzip ~/neurolab.zip -d ~/neurolab-release
cd ~/neurolab-release
sudo bash deploy/linux/install.sh
sudo systemctl status neurolab
```

Se instala Python 3.11 y un servicio `systemd` con usuario sin login `neurolab`. Código en `/opt/neurolab`, datos en `/var/lib/neurolab`, logs con `sudo journalctl -u neurolab -n 100 --no-pager`. No desactivar SELinux.

En ambos servidores se usa **un solo worker Uvicorn**: los eventos SSE y el estado de entrenamiento son locales al proceso. El frontend y `/api/v1` comparten el puerto 80; no se necesita `vite preview` en producción ni exponer los puertos 28400/28401. Antes de actualizar, terminar los entrenamientos y respaldar los datos con el servicio detenido. Al ejecutar el instalador de nuevo se conservan los datos, pero la instalación no ofrece un rollback automático.

Con las VM ya encendidas, comprobar DNS, web por IP y DNS, health, login, puerto RDP y autenticación SSH (la clave de host se obtiene primero mediante Azure):

```powershell
./deploy/Verify.ps1
# Opcional: además crea un entrenamiento de una época con datos sintéticos en cada VM:
./deploy/Verify.ps1 -Train
# Tras apagar y volver a encender, comprobar el modelo existente sin entrenar de nuevo:
./deploy/Verify.ps1 -ExistingModel
```

El verificador no enciende máquinas. `-Train` deja un trabajo y un modelo de demostración en cada base; puede usarse con `-Target Windows` o `-Target Alma`. Para revisar solo la web sin SSH/RDP usar `-SkipRemoteAccess`. La prueba RDP verifica el puerto; la sesión de escritorio se inicia manualmente con la contraseña local. Las claves de host verificadas se guardan en `~/.ssh/known_hosts_neurolab`; si cambian, la comprobación se detiene y exige revisar la rotación.

`-ExistingModel` comprueba que el registro y el binario de un entrenamiento anterior siguen disponibles. La descarga de comprobación se mantiene en memoria y no publica el modelo fuera del equipo operador.

El HTTP de este laboratorio está limitado a la IP del operador. Para una demostración usar datos y contraseñas desechables; para acceso público o datos reales se requiere HTTPS, autenticación/autorización en el backend y quitar usuarios predeterminados. Restringir la IP no cifra el tráfico.

## Acceso para agentes de IA

`AGENTS.md` documenta reglas; no contiene credenciales y no abre conexiones. Un agente ejecutado en este equipo puede usar:

1. **Azure CLI + Run Command** en las dos VM, mediante tu sesión autenticada. Evita instalar un agente permanente o abrir SSH en Windows. Los comandos deben ser explícitos y el operador debe autorizar el alcance de la sesión. Los permisos efectivos son los de la identidad de Azure; no se ha creado una identidad separada con privilegios reducidos.
2. **SSH por clave** en AlmaLinux, con comprobación de huella y la restricción `/32` del NSG.
3. **RDP** para administración visual en Windows. Para automatizar no es necesario controlar el escritorio.

Ejemplos de diagnóstico (solo funcionan con la VM encendida; no la encienden):

```powershell
az vm run-command invoke -g rg-neurolab-demo -n neurolab-win --command-id RunPowerShellScript --scripts 'Invoke-RestMethod http://127.0.0.1/health' --query 'value[].message' -o tsv
az vm run-command invoke -g rg-neurolab-demo -n neurolab-alma --command-id RunShellScript --scripts 'curl --fail --silent http://127.0.0.1/health' --query 'value[].message' -o tsv
```

No guardar claves privadas en prompts ni registros. Para colaboración con el compañero, crear identidades independientes y asignar permisos solo al grupo del laboratorio; no compartir la sesión personal ni una contraseña de administrador entre agentes.

## GitHub ahora y después

El workflow `validate.yml` ejecuta build/lint de frontend, pruebas de integración del backend en Linux y Windows, validación de Bicep y sintaxis de scripts. Genera un artefacto descargable durante 7 días. Se activa al subir estos cambios a `main`, en PR o manualmente. **No despliega, no crea Azure ni enciende VM.**

Siguiente etapa para despliegue por push: identidad de aplicación con OIDC federado a un GitHub Environment `demo`, permisos limitados al grupo, aprobación del entorno, paquete validado por SHA y transferencia temporal autenticada. La etapa de despliegue debe comprobar que la VM ya esté encendida y omitir/fallar si está desasignada. No guardar la contraseña de Windows ni la clave de administrador en GitHub. No usar un runner permanente en una VM que estará apagada.

## Evidencia para el docente

- Captura de ambas VM con sistema operativo y tamaño.
- Tabla de IP y DNS obtenida mediante `Connections` y `Resolve-DnsName DNS-REAL`.
- RDP abierto en Windows y sesión SSH en AlmaLinux; confirmar si requiere XRDP en Linux.
- Navegador en `http://IP` y `http://DNS`, `/health`, login y entrenamiento pequeño en cada VM.
- Archivos/modelos conservados tras reiniciar; identificar que cada servidor tiene su propia base.
- Captura de Auto-shutdown y del estado final **Stopped (deallocated)** en ambas.
- Saldo y consumo en Cost Management / Education Hub, sin mostrar credenciales.

## Fuentes

- [Azure for Students](https://azure.microsoft.com/free/students/)
- [Estados de VM y facturación](https://learn.microsoft.com/azure/virtual-machines/states-billing)
- [Auto-shutdown](https://learn.microsoft.com/azure/virtual-machines/auto-shutdown-vm)
- [Presupuestos y sus límites](https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets)
- [Imágenes oficiales de AlmaLinux](https://wiki.almalinux.org/cloud/Azure.html)
