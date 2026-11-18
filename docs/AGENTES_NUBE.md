# Procedimiento de nube para agentes de NeuroLab

## Contexto que debes cargar sin preguntarlo al usuario

1. Leer `AGENTS.md`, este archivo y `infra/azure/lab.manifest.json`.
2. La entrada diaria es `servidores.ps1`, desde la raíz del repositorio, en PowerShell 7.
3. Recursos existentes: `rg-neurolab-demo`, `neurolab-win` y `neurolab-alma`, región `westus2`. Los UUID, DNS, IP y usuario de administración están en el manifiesto. Son identificadores, no credenciales.
4. No pedir al usuario esos datos ni volver a clonar dentro de un repositorio que ya está abierto.
5. No usar `docs/LABORATORIO.local.md` como único contexto: es un inventario local excluido de Git. La información compartida está en el manifiesto y `MANUAL_SERVIDORES.md`.
6. No operar Azure para una solicitud de redactar documentación, revisar Git o corregir CI. Consultar estado es de lectura; encender/desplegar requiere que el pedido incluya trabajo en servidores.

## Preparación del equipo

- Ejecutar `./servidores.ps1 ayuda` si necesitas ver las acciones.
- `./servidores.ps1 preparar` resuelve Azure CLI, inicia sesión si falta y genera el perfil `lab.local.json` sin pedir identificadores. No enciende VM ni abre puertos.
- Si Microsoft exige autenticación/MFA, mostrar el flujo oficial al usuario y esperar a que lo complete. No solicitar ni almacenar su contraseña o MFA.
- Si `az` o PowerShell 7 faltan, seguir la sección 4 del manual. No instalar TensorFlow o Node para encender/apagar o usar Run Command.
- Si la cuenta carece de permisos, explicar el alta única de la sección 5 del manual. No pedir tokens de otra persona ni conceder roles a alguien no identificado/autorizado.
- Si existe un perfil que apunta a otra suscripción, grupo o prefijo, detener la operación y revisar la discrepancia. No borrar ese perfil ni sustituirlo a ciegas.

## Interpretar el pedido

| Intención del usuario | Acción |
|---|---|
| «Conexión a nuestros servidores», «levántalos para trabajar», «quiero presentar» | `./servidores.ps1 conectar` |
| «Estado», «¿están apagados?» | `./servidores.ps1 estado` |
| «Enlaces», «IP o DNS» | `./servidores.ps1 accesos` |
| «Prueba la aplicación» con sesión ya abierta | `./servidores.ps1 probar` |
| «Entrenamiento corto» | `./servidores.ps1 probar -Entrenar` |
| «Verifica persistencia» | `./servidores.ps1 probar -ModeloExistente`; si pide reiniciar, comprobar estados antes y después |
| «Haz pruebas y luego apaga» | `./servidores.ps1 probar-apagar`, con `-Entrenar` o `-ModeloExistente` si corresponde |
| «Logs», «diagnostica por qué falla» | `./servidores.ps1 diagnostico`; no encender solo por leer logs |
| «Despliega mis cambios» | Revisar versión, respaldos y cambios; con sesión abierta ejecutar `./servidores.ps1 desplegar` |
| «Terminé», «apágalos» | `./servidores.ps1 apagar` |

### Sesión interactiva y cierre

Cuando el usuario pide levantar para usar, `conectar` deja las VM encendidas. **El final de una respuesta del agente no implica que haya terminado la sesión de trabajo del usuario.** Informar enlaces, resultados y apagado diario a las 22:00 de Lima. No apagarlas inmediatamente después de entregar los enlaces.

Cuando pide una validación puntual y cierre, usar el flujo con `finally` (`probar-apagar`). Cuando indica que terminó, ejecutar `apagar` y comprobar `PowerState/deallocated` en ambas; no limitarse a recomendarlo. Antes de apagar una sesión compartida, respetar cualquier indicación de que el compañero sigue trabajando. Si el usuario pide apagar ambas explícitamente, eso autoriza la acción indicada.

`conectar` solo intenta revertir VM que no estaban encendidas antes de una apertura fallida. Una sesión preexistente no se apaga por un fallo de acceso de un nuevo operador. Una desasignación fallida debe reportarse con el nombre y estado real; no decir «apagadas» sin comprobación.

## Red y uso desde casa

`conectar` obtiene la IPv4 pública del equipo y crea/actualiza una regla `neurolab-device-<id>` en ambos NSG. Cada regla autoriza solamente ese `/32`, HTTP y el puerto de administración correspondiente. Mantiene las reglas de los demás equipos.

No usar `0.0.0.0/0`, ampliar rangos, desactivar NSG o desactivar SELinux para resolver un acceso. Si falla la detección de IPv4, reintentar o pedir únicamente la IP necesaria, explicando el fallo concreto; no pedir de nuevo la arquitectura completa.

El antiguo `Lab.ps1 -Action UpdateAccess` actualiza reglas compartidas originales. Preferir el wrapper con reglas por equipo. No ejecutar Bicep `Deploy` para encender o cambiar de red. Reaplicar la plantilla puede reemplazar reglas NSG declaradas; los operadores deberán recrear sus reglas con `conectar`.

## Acceso remoto para los agentes

La vía por defecto es **Azure CLI + Run Command**, bajo la sesión autorizada del operador. No necesita contraseña RDP ni clave SSH. No se creó una identidad separada para agentes ni hay autorización por el mero hecho de leer AGENTS.md.

Para diagnósticos usar `servidores.ps1 diagnostico`. Para comandos específicos del pedido, obtener configuración del manifiesto y usar `az vm run-command invoke` con `RunPowerShellScript` en Windows o `RunShellScript` en AlmaLinux. Comprobar que la VM ya esté encendida. Usar archivos de script con `--scripts @archivo` cuando el contenido incluya comillas, varias líneas o caracteres que Windows CMD pueda interpretar; no volcar SAS ni credenciales en la salida.

SSH es opcional. En el equipo original la clave está en `~/.ssh/neurolab_azure`, y la pública en `.pub`. `deploy/Verify.ps1 -Target Alma` verifica la clave del host mediante Azure y autentica. Otro equipo puede no tener esa privada: usar Run Command, no pedir que la peguen en el chat. Si se pide alta SSH, generar una clave propia y autorizar solo su pública mediante un procedimiento explícito que conserve las existentes. No omitir la comprobación de huella.

RDP es para el usuario humano. La contraseña original está cifrada con DPAPI en `~/.azure/neurolab-windows.credential.xml`, utilizable solo en el equipo/usuario originales. No descifrarla ni mostrarla en respuestas del agente. Guiar al usuario a consultarla localmente o a su recuperación legítima. No resetear contraseñas como parte de una comprobación ordinaria.

## Datos y cambios

- Los datos permanentes están en `C:\NeuroLab\data` y `/var/lib/neurolab`. Nunca reemplazarlos con carpetas del checkout.
- Dos instalaciones completas, dos SQLite y dos colecciones de modelos independientes.
- Un solo worker Uvicorn: SSE y entrenamiento usan estado en memoria del proceso.
- La API conserva usuarios de demo y carece de autorización efectiva en todas las rutas. Mantener HTTP restringido a `/32`, usar datos sintéticos y no abrir el sistema a Internet como producción.
- Respaldar antes de cambios importantes, migraciones o reinstalación. No borrar VM, discos, grupo, usuarios o modelos para simplificar una reparación.
- Para publicar: compilar el paquete local antes de transferirlo. La publicación no sincroniza datos ni ofrece rollback automático.
- No cambiar licencias, suscripción a pago por uso, límite de gasto, tamaño o región para eludir una restricción sin un pedido específico.
- Un push solo ejecuta CI. No encender Azure para comprobar GitHub Actions ni añadir despliegue automático silencioso.

## Respuesta al usuario

Reportar el resultado y la evidencia relevante: ambas VM y estados, web/API comprobadas, si se creó un entrenamiento, si la sesión queda abierta o desasignada, y cualquier fallo real pendiente. No afirmar acceso RDP gráfico si solo se probó el puerto. No prometer costo cero cuando queden discos e IP públicas.

No pedir confirmaciones rutinarias si el usuario ya solicitó la operación. Las únicas intervenciones inevitables son autenticación real, permisos que todavía no existen o decisiones destructivas/de alcance ambiguo. El contexto técnico conocido se lee del proyecto.
