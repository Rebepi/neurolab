@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title NeuroLab Enterprise - Deep Learning Studio (Backend + Frontend + Cloudflare)
color 0B
cls

if "%CLOUDFLARE_TUNNEL_TOKEN%"=="" if exist "%~dp0.cloudflare-token" (
    set /p CLOUDFLARE_TUNNEL_TOKEN=<"%~dp0.cloudflare-token"
)
set "CLOUDFLARED_BIN=cloudflared.exe"

where cloudflared.exe >nul 2>&1
if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe" (
        set "CLOUDFLARED_BIN=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"
    )
)

echo =========================================================================
echo          NEUROLAB ENTERPRISE - DEEP LEARNING STUDIO (TF 2.21)
echo =========================================================================
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :28401 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :28400 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo [1/3] Iniciando Backend FastAPI + TensorFlow (Puerto 28401)...
start "NeuroLab - Backend FastAPI" /min cmd /c "cd /d backend && (if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat) && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && python run.py"

echo [2/3] Compilando e Iniciando Frontend Produccion (Puerto 28400)...
start "NeuroLab - Frontend Vite" /min cmd /c "cd /d frontend && call npx vite build && call npx vite preview --port 28400 --host"

echo.
echo Esperando inicializacion de servicios locales...
ping 127.0.0.1 -n 5 >nul

echo [3/3] Conectando Tunel Seguro Cloudflare...
echo.
echo =========================================================================
echo   SISTEMA ACTIVO Y CONECTADO:
echo   - Local Frontend: http://localhost:28400
echo   - Local Backend:  http://localhost:28401
echo   - Tunel Remoto:   https://neurolab.rebepi.com
echo =========================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cloudflared.exe' -and ($_.CommandLine -like '*53964948-579c-4b21-9c7e-44280d0f5d06*' -or ($env:CLOUDFLARE_TUNNEL_TOKEN -and $_.CommandLine -like ('*' + $env:CLOUDFLARE_TUNNEL_TOKEN + '*'))) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

if not "%CLOUDFLARE_TUNNEL_TOKEN%"=="" (
    start "NeuroLab - Cloudflare Tunnel" /min cmd /c ""%CLOUDFLARED_BIN%" tunnel run --protocol http2 --token %CLOUDFLARE_TUNNEL_TOKEN%"
)

exit /b 0