@echo off
setlocal enabledelayedexpansion
title NeuroLab Enterprise - Detener Servicios
color 0C
cls

if "%CLOUDFLARE_TUNNEL_TOKEN%"=="" if exist "%~dp0.cloudflare-token" (
    set /p CLOUDFLARE_TUNNEL_TOKEN=<"%~dp0.cloudflare-token"
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":28400 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":28401 "') do taskkill /f /pid %%a >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq NeuroLab*" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cloudflared.exe' -and ($_.CommandLine -like '*53964948-579c-4b21-9c7e-44280d0f5d06*' -or ($env:CLOUDFLARE_TUNNEL_TOKEN -and $_.CommandLine -like ('*' + $env:CLOUDFLARE_TUNNEL_TOKEN + '*'))) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

exit /b 0