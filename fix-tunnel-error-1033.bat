@echo off
title Fix Cloudflare Tunnel Error 1033

echo ==========================================
echo   Fixing Cloudflare Tunnel Error 1033
echo ==========================================
echo.

echo This script will attempt to fix Cloudflare Tunnel Error 1033 by:
echo 1. Checking for cloudflared installation
echo 2. Looking for credentials in the default location
echo 3. Copying credentials to the project directory
echo.

REM Check if cloudflared is installed
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: cloudflared is not installed or not in PATH
    echo.
    echo Please install cloudflared from:
    echo https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo ✅ cloudflared is installed
echo.

REM Check if credentials exist in default location
set CREDENTIALS_FOUND=0
set CREDENTIALS_FILE=

if exist "%USERPROFILE%\.cloudflared\*.json" (
    for /f "delims=" %%i in ('dir /b "%USERPROFILE%\.cloudflared\*.json"') do (
        set CREDENTIALS_FILE=%USERPROFILE%\.cloudflared\%%i
        set CREDENTIALS_FOUND=1
        echo Found credentials file: %%i
        goto :found
    )
)

:found
if %CREDENTIALS_FOUND% equ 0 (
    echo ❌ No credentials file found in default location
    echo.
    echo Please:
    echo 1. Create a tunnel using cloudflared tunnel create
    echo 2. Or download your credentials file from Cloudflare dashboard
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo.
echo Copying credentials to project directory...
copy "%CREDENTIALS_FILE%" "tunnel-config\credentials.json" >nul

if %errorlevel% equ 0 (
    echo ✅ Credentials copied successfully
) else (
    echo ❌ Failed to copy credentials
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo.
echo ==========================================
echo   Cloudflare Tunnel Error 1033 Fix Complete
echo ==========================================
echo.
echo ✅ Credentials file copied to tunnel-config\credentials.json
echo.
echo Important: Make sure the tunnel ID in tunnel-config\config.yaml
echo matches the one in credentials.json
echo.
echo You can now start your tunnel with:
echo   start-tunnel.bat
echo.
echo Or test the configuration with:
echo   node test-tunnel.js
echo.
echo Press any key to exit...
pause >nul