# NeuroLab: manual para casa, el compañero y los agentes de IA

**Empieza aquí.** Este manual permite operar los **dos servidores que ya existen**. No hace falta volver a crearlos ni recordar sus identificadores. El comando `servidores.ps1` lee el contexto del repositorio y prepara la configuración local de cada equipo.

Última instalación y comprobación completa: **17 de noviembre de 2026, hora de Lima**. Se verificaron frontend, API, login, entrenamiento, SSH en AlmaLinux, puerto RDP en Windows y conservación de modelos después de desasignar y encender las VM. El estado de Azure cambia con el uso: consultarlo con `estado`; esta fecha no sustituye una consulta actual.

## 1. Lo único que usarás normalmente

Abrir este proyecto en el agente o en PowerShell 7. Para una sesión de trabajo:

```powershell
./servidores.ps1 conectar
```

El comando selecciona la suscripción del proyecto, detecta la IPv4 pública actual, prepara una regla de acceso propia de ese equipo, enciende **las dos VM existentes**, espera a que la aplicación responda y muestra sus enlaces. **Las deja encendidas para que puedas trabajar.** Si falla la apertura de la sesión, intenta desasignar las VM que no estaban ya encendidas al comenzar; conserva las sesiones preexistentes del compañero.

Para terminar:

```powershell
./servidores.ps1 apagar
```

El resultado esperado es `PowerState/deallocated` en **las dos**. Cerrar el navegador, el chat, SSH o la ventana RDP no apaga las VM.

Para consultar sin encender:

```powershell
./servidores.ps1 estado
./servidores.ps1 accesos
```

Para pedírselo al agente, puedes decir:

> Lee AGENTS.md. Quiero conexión a nuestros servidores: levántalos para trabajar y comprueba la web. Déjalos encendidos para mi sesión.

Y al terminar:

> Terminé. Desasigna nuestros dos servidores y confirma sus estados finales.

El agente encontrará nombres, suscripción, rutas y procedimiento en el repositorio. Solo hay dos requisitos que un archivo de texto no puede sustituir: **iniciar sesión con una cuenta autorizada** y **tener permisos de Azure**. Se preparan una vez por persona/equipo. Nunca debes enviar al agente contraseñas, códigos MFA, tokens ni claves privadas.

## 2. Qué quedó instalado y dónde

Repositorio: [Rebepi/neurolab](https://github.com/Rebepi/neurolab).

| Dato | Valor del laboratorio |
|---|---|
| Suscripción | Azure for Students |
| Grupo de recursos | `rg-neurolab-demo` |
| Región | `westus2` — West US 2 |
| Tamaño de cada VM | `Standard_B2als_v2`, 2 vCPU, 4 GiB RAM |
| Windows | Windows Server 2022, `neurolab-win` |
| Linux | AlmaLinux 9, `neurolab-alma` |
| Administrador del sistema operativo | `neurolabadmin` |
| Apagado diario de respaldo | 22:00 en Lima, equivalente a 03:00 UTC |
| Encendido automático | Ninguno |

| Servidor | IP pública estática | Nombre DNS |
|---|---|---|
| Windows | `20.112.93.115` | `neurolab-win-qhxnndvnd6qem.westus2.cloudapp.azure.com` |
| AlmaLinux | `13.66.155.80` | `neurolab-alma-qhxnndvnd6qem.westus2.cloudapp.azure.com` |

Enlaces, disponibles cuando las VM están encendidas y tu IP está autorizada:

- [NeuroLab en Windows por DNS](http://neurolab-win-qhxnndvnd6qem.westus2.cloudapp.azure.com).
- [NeuroLab en Windows por IP](http://20.112.93.115).
- [NeuroLab en AlmaLinux por DNS](http://neurolab-alma-qhxnndvnd6qem.westus2.cloudapp.azure.com).
- [NeuroLab en AlmaLinux por IP](http://13.66.155.80).

**Cada VM tiene una copia completa e independiente de la aplicación.** Un proyecto, usuario o modelo creado en Windows no aparece automáticamente en AlmaLinux. Actualizar el código en ambas tampoco sincroniza sus bases de datos.

| Componente | Windows | AlmaLinux |
|---|---|---|
| Código | `C:\NeuroLab\backend` y `C:\NeuroLab\frontend\dist` | `/opt/neurolab/backend` y `/opt/neurolab/frontend/dist` |
| Datos que se conservan | `C:\NeuroLab\data` | `/var/lib/neurolab` |
| Base SQLite | `C:\NeuroLab\data\neurolab.db` | `/var/lib/neurolab/neurolab.db` |
| Modelos | Subcarpeta `models` de los datos | Subcarpeta `models` de los datos |
| Arranque de la aplicación | Tarea programada `NeuroLab`, usuario LOCAL SERVICE | Servicio systemd `neurolab`, usuario `neurolab` |
| Logs | `C:\NeuroLab\logs\app.log` y `app-error.log` | `journalctl -u neurolab` |
| Web y API | Puerto 80, un proceso Uvicorn | Puerto 80, un proceso Uvicorn |
| Administración | RDP 3389 y Azure Run Command | SSH 22 y Azure Run Command |

El frontend React compilado y FastAPI se sirven por el mismo origen. No hay que abrir `28400`, `28401` ni `8000` para acceder desde Internet. Los `.bat` originales son para el entorno local anterior con Cloudflare; **no usarlos para este laboratorio Azure**.

## 3. Si vuelves a casa con la misma laptop

1. Conecta la laptop a Internet.
2. Abre la carpeta del proyecto en Codex o en tu agente de programación.
3. Si usas terminal, abre **PowerShell 7** en la raíz del proyecto: la carpeta donde están `AGENTS.md` y `servidores.ps1`.
4. Ejecuta `./servidores.ps1 conectar`, o usa el mensaje de la sección 1.
5. Si Microsoft pide iniciar sesión otra vez, complétalo tú en la página oficial. El código del flujo de dispositivo lo muestra Azure CLI; no es necesario pegarlo de vuelta en el repositorio.
6. Espera. Encender Windows y cargar TensorFlow puede tardar varios minutos.
7. Abre el enlace que muestra el comando.
8. Cuando acabes, ejecuta `./servidores.ps1 apagar` o pídelo al agente.

**Cambiar del instituto a casa no requiere editar una IP a mano.** `conectar` detecta la IP actual y actualiza solamente la regla de este equipo. Si usas VPN o cambias de red durante la sesión, vuelve a ejecutar `conectar`; también puede usarse sobre VM ya encendidas.

## 4. Preparar otra computadora desde cero — una sola vez

### 4.1. Instalar lo necesario en Windows

Para encender, apagar, probar la web y leer logs necesitas **Git, PowerShell 7 y Azure CLI**. No necesitas instalar TensorFlow, Python, Node ni copiar una clave SSH para esas operaciones.

Desde una terminal de Windows con `winget`:

```powershell
winget install --exact --id Git.Git
winget install --exact --id Microsoft.PowerShell
winget install --exact --id Microsoft.AzureCLI
```

Si pide aceptar condiciones o permisos de instalación, leerlos y completar la instalación. Si `winget` no existe, usar las descargas oficiales de [Git](https://git-scm.com/downloads/win), [PowerShell](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows) y [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli-windows).

Cierra la terminal y abre la aplicación **PowerShell 7**. Puedes comprobarlo con:

```powershell
$PSVersionTable.PSVersion
git --version
az version
```

La versión de PowerShell debe empezar con `7`. El script principal no está diseñado para Windows PowerShell 5.1.

Si Windows informa que la ejecución de scripts está deshabilitada, habilitar los scripts locales **solo para esa terminal** y volver a intentar:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

No cambia la política permanente del equipo. Si una política institucional impide modificarla, consultar al administrador; no desactivar protecciones del equipo para eludirla.

### 4.2. Descargar el proyecto

```powershell
Set-Location $env:USERPROFILE
New-Item -ItemType Directory -Force -Path Projects | Out-Null
Set-Location Projects
git clone https://github.com/Rebepi/neurolab.git
Set-Location neurolab
./servidores.ps1 preparar
```

Si el repositorio ya existe en ese equipo, entrar en su carpeta y usar `git pull --ff-only` antes de preparar. Si hay cambios propios sin guardar o un conflicto, conservarlos y pedir al agente que revise el estado de Git; no usar `reset --hard` ni borrar la carpeta para resolverlo.

### 4.3. Iniciar sesión

`preparar` abre el flujo de Microsoft Azure CLI si no hay una sesión guardada. El directorio de Azure y la suscripción ya están identificados en `infra/azure/lab.manifest.json`.

1. Abre la URL oficial que muestre Azure CLI.
2. Ingresa el código temporal que muestra la terminal.
3. Inicia sesión con **tu propia cuenta que tenga acceso al laboratorio**.
4. Revisa que la aplicación sea **Microsoft Azure CLI**.
5. Completa el MFA cuando corresponda.
6. Regresa a la terminal y espera a que termine.

Para Diego normalmente es la misma cuenta educativa usada al crear el laboratorio. Para el compañero es su cuenta autorizada previamente; tener acceso al repositorio GitHub no concede permisos de Azure.

`preparar` genera `infra/azure/lab.local.json`. **No enciende las VM ni cambia las reglas de red.** Después puedes usar:

```powershell
./servidores.ps1 estado
./servidores.ps1 conectar
```

Los IDs de suscripción y directorio del manifiesto identifican los recursos, pero **no son credenciales** y no conceden acceso. La configuración real del equipo, los tokens de Azure y las claves permanecen fuera de Git.

## 5. Cómo dar acceso al compañero

Hay dos escenarios diferentes. Elige el que realmente necesita.

### A. Solo quiere abrir la web y hacer pruebas en el navegador

No necesita RDP, una clave SSH ni una cuenta de administrador del sistema.

La forma más sencilla con autonomía es autorizar su cuenta de Azure como se explica en B; luego él ejecuta `conectar` y `apagar` por sí mismo. Si solo va a mirar una demostración, Diego puede mantener la sesión desde su equipo y autorizar exclusivamente la IPv4 pública del compañero mediante una regla temporal HTTP del NSG, sin entregarle credenciales. Esa regla debe ser `/32`, puerto 80 y solo para la prueba; no abrir Internet completo. Un agente del propietario puede obtener los nombres de NSG del manifiesto y realizar ese cambio cuando se le indique la IP pública de destino.

Si ambos están en la misma red y salen a Internet por la misma IPv4 pública, una regla de esa IP cubre a ambos. Desde redes diferentes cada uno requiere su propia regla.

### B. Quiere encender, apagar, desplegar y usar sus agentes

**Esta autorización se hace una vez por el propietario de Azure. No se hace automáticamente por clonar Git.** No hemos invitado ni concedido permisos a una persona desconocida durante la preparación del proyecto.

Pasos para el propietario:

1. Entra a [Azure Portal](https://portal.azure.com/) con la cuenta que administra el laboratorio.
2. Si la cuenta del compañero aún no pertenece al directorio, entra a **Microsoft Entra ID → Usuarios → Nuevo usuario → Invitar usuario externo**.
3. Invita el correo de su cuenta Microsoft/educativa. El compañero debe aceptar la invitación con esa cuenta. No compartir la contraseña de Diego.
4. Vuelve a **Grupos de recursos → rg-neurolab-demo → Control de acceso (IAM)**.
5. Selecciona **Agregar → Agregar asignación de rol**.
6. Para un compañero de confianza que gestionará todo el laboratorio, selecciona **Colaborador / Contributor**.
7. Selecciona su usuario y revisa que el **ámbito sea únicamente `rg-neurolab-demo`**; no toda la suscripción.
8. Guarda la asignación y espera unos minutos a que se propague.
9. El compañero prepara su computadora siguiendo la sección 4 y ejecuta `conectar` con su propia cuenta.

Contributor permite administrar y también **eliminar recursos del grupo**; Azure Run Command ejecuta código como administrador/root. Por eso se reserva para el compañero de confianza encargado de despliegues. Para observar recursos, usar **Lector / Reader**, que no permite encender ni desplegar. No se necesita concederle Owner ni capacidad de asignar roles para el uso diario.

Si SENATI impide invitar usuarios externos o tu cuenta no tiene permiso para invitar/asignar roles, debe intervenir el administrador del directorio. No se resuelve copiando un token de Azure ni una contraseña al GitHub. Mientras tanto, el propietario puede operar la nube y el compañero desarrollar o probar la web desde una IP autorizada.

### Dos compañeros conectados a la vez

El comando nuevo crea una regla `neurolab-device-...` por equipo/usuario. Mantiene la IPv4 `/32` de cada uno y conserva las reglas de los demás. No usar el antiguo `Lab.ps1 -Action UpdateAccess` como procedimiento compartido diario: actualiza las reglas comunes originales y no administra reglas por dispositivo.

El laboratorio comparte estado de encendido: **si uno apaga las VM, las apaga para todos**. Antes de usar `apagar`, coordinar si el otro sigue trabajando. Las reglas personales antiguas permanecen hasta que el propietario las retire; al dejar de usar un equipo, eliminar solo su regla en ambos NSG.

## 6. Pedidos que puedes hacerle al agente

El agente debe trabajar en esta carpeta. Un agente abierto en una carpeta ajena o una conversación sin acceso al repositorio no tiene por qué conocerlo. En la raíz, `AGENTS.md` lo dirige a `docs/AGENTES_NUBE.md` y al manifiesto.

| Tu mensaje | Operación esperada |
|---|---|
| «Quiero conexión a nuestros servidores, levántalos» | `./servidores.ps1 conectar`; comprobar y dejar encendidos para tu sesión |
| «¿Están apagados?» | `./servidores.ps1 estado`; no encender |
| «Haz pruebas y apágalos al terminar» | `./servidores.ps1 probar-apagar`; cierre en `finally` |
| «Haz un entrenamiento corto y luego apaga» | `./servidores.ps1 probar-apagar -Entrenar` |
| «Comprueba que mis modelos se conservaron» | `./servidores.ps1 probar -ModeloExistente` con VM ya encendidas |
| «Revisa por qué falla» | `./servidores.ps1 diagnostico`; no encender solo para leer logs |
| «Actualiza el sistema desplegado» | Revisar Git, abrir sesión si se pidió, respaldar datos y ejecutar `desplegar` |
| «Terminé, apaga todo» | `./servidores.ps1 apagar`; confirmar las dos desasignadas |

El agente **no debe pedir otra vez** la suscripción, región, nombres, IP, DNS o rutas: ya están registrados. Puede pedir una acción real imprescindible: completar Microsoft/MFA, conceder permisos a otra persona, recuperar una credencial de escritorio o aclarar un cambio que pueda borrar datos. No puede eludir esos requisitos ni guardar credenciales en el manual para evitarlos.

La vía normal de los agentes es **Azure CLI + Azure Run Command**, válida en ambos sistemas. No requiere la contraseña de Windows ni una clave SSH. Los comandos se ejecutan bajo los permisos de la cuenta Azure autenticada; `AGENTS.md` contiene instrucciones, no es un mecanismo de autenticación.

## 7. Entrar al escritorio de Windows

1. Ejecuta `./servidores.ps1 conectar`.
2. En Windows abre **Conexión a Escritorio remoto** (`mstsc`).
3. En «Equipo» escribe `neurolab-win-qhxnndvnd6qem.westus2.cloudapp.azure.com` o `20.112.93.115`.
4. Usa el usuario **`neurolab-win\neurolabadmin`**.
5. Introduce la contraseña del servidor de forma privada.
6. Dentro del escritorio puedes abrir `http://127.0.0.1` para ver NeuroLab.
7. Al desconectar RDP, la VM seguirá encendida. Termina con `./servidores.ps1 apagar` desde tu equipo.

### Dónde está la contraseña creada originalmente

En el equipo y usuario Windows originales de Diego está en:

```text
%USERPROFILE%\.azure\neurolab-windows.credential.xml
```

Para consultarla **solo en tu terminal local**, sin enviarla al agente, al chat, al repositorio ni a capturas:

```powershell
$windowsCredential = Import-Clixml "$env:USERPROFILE/.azure/neurolab-windows.credential.xml"
$windowsCredential.GetNetworkCredential().Password
```

Ese XML está protegido con DPAPI: copiarlo a otro usuario o computadora **no permite descifrarlo allí**. Antes de cambiar de equipo, guarda la contraseña en un gestor de contraseñas o medio cifrado bajo tu control. El manifiesto y Git no guardan la contraseña en texto plano.

El propietario dispone además de un **TXT privado en Descargas** con la contraseña, par SSH, rutas e instrucciones de `.env`. El archivo `infra/azure/private-backup/neurolab-credentials.enc` permite recuperar esas credenciales desde Git **solo con la clave AES que está en ese TXT**, fuera del repositorio. La [guía del respaldo](infra/azure/private-backup/README.md) explica cómo validar y restaurar en otro equipo sin sobrescribir credenciales diferentes. No pegar su contenido en el chat: un agente autorizado puede ejecutar el restaurador local sin mostrar los secretos. Esta recuperación no sustituye el inicio de sesión Azure de cada persona.

Si no la conservaste, aún puedes administrar las VM con tu sesión autorizada de Azure. Para recuperar RDP, el propietario puede usar **VM Windows → Ayuda / Restablecer contraseña** en Azure Portal y establecer una nueva. Eso cambia la credencial de RDP; no es un paso rutinario y debe coordinarse con el compañero. No hace falta restablecerla para que los agentes operen por Azure Run Command.

## 8. SSH en AlmaLinux

En el equipo original existe esta clave privada dedicada:

```text
%USERPROFILE%\.ssh\neurolab_azure
```

Y su archivo público termina en `.pub`. La privada **no se sube a Git ni se entrega al compañero**.

En el equipo original, con la VM encendida, primero se puede ejecutar:

```powershell
./deploy/Verify.ps1 -Target Alma
```

Esta comprobación obtiene la clave pública del host mediante el canal autenticado de Azure, la compara con `known_hosts_neurolab` y autentica por SSH. Después:

```powershell
ssh -i "$env:USERPROFILE/.ssh/neurolab_azure" -o 'UserKnownHostsFile="~/.ssh/known_hosts_neurolab"' -o StrictHostKeyChecking=yes neurolabadmin@neurolab-alma-qhxnndvnd6qem.westus2.cloudapp.azure.com
```

Si la clave de host cambia, investigar la causa antes de actualizarla. No usar `StrictHostKeyChecking=no`.

**En otro equipo se puede operar sin SSH**, usando `servidores.ps1` y Azure Run Command. Si el compañero necesita una sesión SSH interactiva, debe generar su propio par de claves con `ssh-keygen`, conservar la privada en su equipo y pedir a un administrador que **añada su `.pub`** a `~/.ssh/authorized_keys` del usuario autorizado, sin sustituir ni borrar las claves existentes. Para una identidad de sistema separada, crear un usuario propio y sus permisos de sudo de forma deliberada. Es un alta de acceso adicional, no parte del encendido diario.

AlmaLinux no tiene entorno gráfico ni XRDP instalados. SSH y Azure Run Command están disponibles. Si el docente exige un escritorio gráfico Linux, ese requisito se implementará aparte y se revisará la memoria necesaria.

## 9. Probar el sistema

Con la sesión abierta:

```powershell
./servidores.ps1 probar
```

Comprueba DNS, frontend HTTP 200, `/health` por DNS e IP y login. Usa la vía web; no exige una clave SSH del equipo original.

Para ejecutar un entrenamiento de una época con el dataset sintético de demostración:

```powershell
./servidores.ps1 probar -Entrenar
```

Deja un trabajo y un modelo en cada VM. Para comprobar un modelo anterior sin crear otro:

```powershell
./servidores.ps1 probar -ModeloExistente
```

La cuenta de aplicación de demostración es `admin@neurolab.io` / `admin123`, ya presente en el código público. **No es la cuenta de Azure, RDP ni SSH.** Usar solamente datos sintéticos. La API actual requiere reforzar autorización y HTTPS antes de abrirla libremente o cargar datos reales.

Los modelos de referencia de la comprobación inicial fueron `mod-job-a5b7146b` en Windows y `mod-job-2fc57318` en AlmaLinux. Si luego se crean o eliminan modelos, esos identificadores pueden dejar de ser la referencia más reciente.

Para una prueba puntual que se cierre sola:

```powershell
./servidores.ps1 probar-apagar -ModeloExistente
```

Este flujo deja ambas VM desasignadas al finalizar, aunque fallen las comprobaciones. No usarlo para abrir una sesión que quieras mantener durante toda la presentación.

## 10. Actualizar la aplicación cuando cambie el código

No se necesita recrear la infraestructura, restablecer contraseñas ni borrar discos.

1. Guarda tus cambios de código y coordina con el compañero la versión que se desplegará.
2. Si vas a traer cambios de GitHub, usa `git status` y `git pull --ff-only`; conserva cualquier trabajo local antes de integrar.
3. Instala Node.js **24.x** en el equipo que compilará, desde [Node.js](https://nodejs.org/). Para compilar el frontend no hace falta instalar TensorFlow local.
4. Abre la sesión con `./servidores.ps1 conectar`.
5. Termina los entrenamientos activos y respalda los datos antes de una actualización importante. Ver la sección 11.
6. Ejecuta:

```powershell
./servidores.ps1 desplegar
```

El comando compila con `npm ci` + `npm run build`, genera un ZIP, lo transfiere de forma temporal mediante Blob privado, verifica SHA-256, instala en ambas VM y comprueba la web. Usa una URL SAS de lectura que vence en una hora y retira el ZIP del Blob al terminar.

La actualización conserva los directorios de datos. **No ofrece rollback automático ni una transacción que actualice ambas VM a la vez.** Si una falla, la otra puede haber recibido la versión nueva: diagnosticar y repetir solo el destino necesario con `deploy/Publish.ps1 -Target Windows` o `-Target Alma`, usando un paquete recién compilado.

`desplegar` exige VM ya encendidas y las deja encendidas para tu sesión. Si falla el despliegue, ejecutar `diagnostico` y después `apagar`; no dejar una sesión abandonada. Los cambios incompatibles de base de datos requieren un plan y un respaldo, no solo copiar un ZIP.

### Qué hace un push en GitHub hoy

El workflow `.github/workflows/validate.yml` valida frontend, backend e infraestructura y genera un artefacto. **No enciende VM ni despliega en Azure.** Ese es el comportamiento intencional actual para controlar el crédito.

Para activar despliegue por push en el futuro hacen falta OIDC, un entorno GitHub con permisos limitados y una etapa que solo despliegue si las VM ya están encendidas. No subir la contraseña RDP ni la clave SSH del administrador como forma de resolverlo. El procedimiento y estado de GitHub deben comprobarse en [Actions](https://github.com/Rebepi/neurolab/actions).

## 11. Respaldo antes de modificar datos o reinstalar

No borrar ni reemplazar `C:\NeuroLab\data` o `/var/lib/neurolab` con datos del repositorio. Las pruebas sintéticas y los entrenamientos también se guardan ahí.

**Windows**, dentro de RDP en PowerShell como administrador:

```powershell
Stop-ScheduledTask -TaskName NeuroLab
# Esperar a que la tarea esté detenida y confirmar que ya no atiende HTTP.
New-Item -ItemType Directory -Force -Path C:\NeuroLabBackups | Out-Null
$backupFile = 'C:\NeuroLabBackups\data-' + (Get-Date -Format yyyyMMdd-HHmmss) + '.zip'
Compress-Archive -Path C:\NeuroLab\data -DestinationPath $backupFile
Start-ScheduledTask -TaskName NeuroLab
```

Si falla la compresión, reiniciar igualmente la tarea o corregir el fallo antes de continuar. La copia debe realizarse sin entrenamientos ni escrituras activas. Los logs normales se renuevan al iniciar el proceso; copiar los necesarios antes de reiniciarlo.

**AlmaLinux**, dentro de SSH, con permisos sudo:

```bash
sudo systemctl stop neurolab
sudo mkdir -p /var/backups/neurolab
sudo tar -czf "/var/backups/neurolab/data-$(date +%Y%m%d-%H%M%S).tar.gz" -C /var/lib neurolab
sudo systemctl start neurolab
```

Si falla el archivo, asegurarse de volver a iniciar el servicio. Copiar el respaldo a almacenamiento privado fuera de esa VM si necesitas sobrevivir a la eliminación del disco. **Un respaldo en el mismo disco no protege contra borrar la VM y su disco.** No subir respaldos, datasets ni modelos al repositorio público.

## 12. Apagado y crédito educativo

- Usa `apagar` cuando termine la sesión, no solo «Apagar» dentro de Windows/Linux.
- El estado correcto es **Stopped (deallocated)** / `PowerState/deallocated` en las dos VM.
- El apagado diario de las 22:00 de Lima es un respaldo. Si enciendes después de esa hora, el próximo evento diario será al día siguiente.
- Si una presentación se extenderá más allá de las 22:00, ajustar ese horario previamente; no asumir que se suspende por estar conectado.
- Discos Windows 127 GiB y AlmaLinux 30 GiB, IP públicas Standard y otros consumos pueden seguir facturándose aun con cómputo desasignado.
- La cuenta auxiliar de transferencia es `stneurolab5c2177a61506`. Se comprobó sin blobs de release activos al finalizar la instalación inicial; las publicaciones futuras vuelven a usarla temporalmente.
- Revisa saldo y vencimiento en Education Hub / [Azure Sponsorships](https://www.microsoftazuresponsorships.com/) y consumo en Azure Cost Management. El saldo exacto no está guardado en Git.
- Los presupuestos y sus alertas no son un corte automático de consumo. Se recomiendan alertas acordes al saldo disponible, pero no están configuradas por este manual.
- El límite de gasto de la suscripción educativa se verificó activado durante la creación. No convertir a pago por uso ni retirarlo para solucionar cuotas.
- Para una pausa larga, decidir expresamente si se respalda/exporta y elimina infraestructura. Los agentes no deben borrar VM, discos o el grupo solo para ahorrar.

## 13. Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| «Necesito PowerShell 7» | Abrir `pwsh`, no Windows PowerShell 5.1; instalar Microsoft.PowerShell si falta |
| `az` no se reconoce | Instalar Azure CLI y abrir otra terminal; el helper también busca su instalación estándar |
| La cuenta no ve la suscripción | Comprobar cuenta/directorio y el alta de la sección 5; clonar Git no da acceso Azure |
| `AuthorizationFailed` | El propietario revisa IAM en `rg-neurolab-demo`; no crear otra suscripción ni compartir tokens |
| «El perfil apunta a otro laboratorio» | Revisar `lab.local.json`; se detiene para evitar operar una suscripción ajena |
| La web no abre al llegar a casa | Ejecutar `conectar` para actualizar la regla de la IP actual y esperar a que termine |
| Cambié de VPN/red durante la sesión | Volver a ejecutar `conectar`; cada equipo conserva su propia regla |
| No puede detectar mi IPv4 | Reintentar; como alternativa `./servidores.ps1 conectar -IpPublica TU-IP-PUBLICA`, sin máscara |
| VM encendida pero web no responde | Esperar el arranque y ejecutar `diagnostico`; revisar tarea/servicio y logs antes de reinstalar |
| RDP rechaza la contraseña | Usar `neurolab-win\neurolabadmin` y la contraseña del servidor, no `admin123` ni la de Azure |
| El XML cifrado no abre en otra PC | Es DPAPI, ligado al equipo/usuario original; recuperar la contraseña por el procedimiento de la sección 7 |
| Falta la clave SSH | Usar la vía Azure CLI normal; no copiar claves privadas al repositorio |
| `Permission denied (publickey)` en SSH | Revisar usuario, clave propia autorizada y huella; Azure CLI puede seguir funcionando |
| Un modelo no aparece en la otra VM | Son dos bases independientes, no hay sincronización |
| La prueba de modelo dice que no hay trabajos completados | Crear uno con `probar -Entrenar` o usar la comprobación web sin `-ModeloExistente` |
| Error de tamaño/cuota/capacidad al encender | Conservar las VM y datos; revisar región, cuota y disponibilidad con el propietario; no recrear ni subir tamaño a ciegas |
| Dejaron de responder ambos mientras trabajaba | Consultar `estado`: otro operador o el apagado diario puede haberlos desasignado |
| Un push falla en Actions | Leer el job fallido; no encender Azure para arreglar un error de CI |
| Solo una VM se actualizó | Conservar datos, diagnosticar y publicar el mismo paquete validado únicamente en el destino pendiente |

## 14. Qué archivos hay y qué se publica

| Archivo/ruta | Uso |
|---|---|
| `MANUAL_SERVIDORES.md` | Este recorrido completo para usuarios |
| `AGENTS.md` | Primera instrucción automática para agentes en este proyecto |
| `docs/AGENTES_NUBE.md` | Procedimiento concreto y límites para agentes |
| `servidores.ps1` | Entrada sencilla en español para las sesiones |
| `infra/azure/lab.manifest.json` | Contexto compartido sin secretos: suscripción/directorio, nombres y DNS |
| `infra/azure/lab.local.json` | Perfil local de cada equipo, excluido de Git; se genera solo |
| `infra/azure/Operations.ps1` | Inicio de sesión, perfil y acceso `/32` por equipo |
| `infra/azure/main.bicep` | Definición para reconstruir infraestructura; no es el encendido diario |
| `infra/azure/Lab.ps1` | Operación técnica de bajo nivel |
| `deploy/Package.ps1` | Compila y empaqueta sin datos ni credenciales |
| `deploy/Publish.ps1` | Publicación con Azure Run Command y Blob temporal |
| `deploy/Verify.ps1` | Verificación avanzada, con SSH opcional y persistencia de modelos |
| `deploy/windows/`, `deploy/linux/` | Instaladores y arranque automático de NeuroLab |
| `docs/AZURE.md` | Referencia técnica de creación y despliegue |
| `.github/workflows/validate.yml` | CI sin encendido ni despliegue automático Azure |
| `tests/` | Comprobaciones de integración y operación sin Azure |

Se publican código, instrucciones, configuración de ejemplo y manifiesto no secreto. **No se publican en texto plano** `lab.local.json`, archivos `.local.*`, `.env`, `.azure`, `.ssh`, contraseñas, claves, tokens, ZIP de despliegue, logs, bases ni modelos. El repositorio es público. Por pedido del propietario se incluye un respaldo de credenciales **cifrado AES-256-GCM** en `infra/azure/private-backup/neurolab-credentials.enc`; su clave aleatoria y el TXT privado de Descargas nunca se suben a Git.

Los cambios del despliegue incluyeron servir React desde FastAPI, centralizar los datos mediante `NEUROLAB_DATA_DIR`, corregir la URL SSE que apuntaba a localhost, añadir `email-validator`, corregir el lockfile de npm, instalar los servicios de ambos sistemas y añadir el apagado diario. La aplicación se comprobó en Azure con Python 3.11; las pruebas locales también validaron el flujo de entrenamiento.

## 15. Lista corta para la presentación

1. Actualizar el repositorio en el equipo que se usará.
2. Abrir este proyecto en el agente y pedir «levanta nuestros servidores para presentar».
3. Esperar la comprobación correcta y abrir ambos enlaces.
4. Mostrar la web por IP y DNS, RDP en Windows y SSH en AlmaLinux si ya tienes tu clave.
5. Mostrar un entrenamiento pequeño o un modelo conservado.
6. Mostrar en Azure los sistemas operativos y el apagado diario.
7. Al terminar y coordinando con el compañero: «apaga nuestros dos servidores».
8. Comprobar las dos `PowerState/deallocated` y revisar consumo/saldo.

No volver a ejecutar `Deploy` de Bicep para una presentación habitual: las VM ya existen y los comandos diarios solo las operan. Una reaplicación de Bicep puede sustituir la lista declarada de reglas NSG; después cada operador debe ejecutar `conectar` para restablecer su regla personal.
