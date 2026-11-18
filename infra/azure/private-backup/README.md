# Respaldo cifrado de credenciales del propietario

`neurolab-credentials.enc` contiene el respaldo del proyecto cifrado con **AES-256-GCM**, clave aleatoria de 256 bits y autenticación de integridad. Incluye contraseña RDP, par SSH, hosts verificados, configuración original e instrucciones privadas. **La clave de descifrado no está en Git.**

El propietario conserva `NEUROLAB_ACCESOS_PRIVADOS.txt` en Descargas. Ese TXT tiene los accesos en texto y la clave AES. Debe permanecer privado y contar con otra copia segura. No enviarlo al chat, subirlo al repositorio ni incorporarlo a `.env`.

Para comprobar la copia desde PowerShell 7.2 o posterior:

```powershell
./infra/azure/Restore-PrivateBackup.ps1 -PrivateTextPath "$env:USERPROFILE/Downloads/NEUROLAB_ACCESOS_PRIVADOS.txt" -ValidateOnly
```

Para restaurar en el perfil Windows del propietario en otro equipo, omitir `-ValidateOnly`. Recupera archivos SSH y genera una credencial DPAPI nueva para ese usuario/equipo. Se detiene si ya existe una credencial diferente. No restaura tokens Microsoft/GitHub, no cambia claves en las VM y no enciende servidores. El perfil local de red se genera después mediante `servidores.ps1 preparar`; no se copia el `operatorId` original.

Sin la clave privada del TXT no es posible abrir el archivo `.enc`. Cambiar credenciales en Azure no actualiza este respaldo automáticamente. Para generar otra copia, `Export-PrivateBackup.ps1` permite rutas nuevas con `-PrivateTextPath` y `-ArchivePath`, sin sobrescribir la anterior. Si cambia el nombre del archivo, pasar ese mismo `-ArchivePath` al restaurador.

Este respaldo es para el propietario. El compañero puede operar con su propia identidad Azure y sus permisos, sin recibir estas credenciales administrativas. Los usuarios de demo de la aplicación no equivalen a las cuentas Azure/RDP/SSH.
