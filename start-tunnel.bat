@echo off
title WhatsApp Commerce Hub - Cloudflare Tunnel

echo ==========================================
echo   WhatsApp Commerce Hub - Cloudflare Tunnel
echo ==========================================
echo.

echo Starting Cloudflare Tunnel for WhatsApp Commerce Hub...
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

REM Check if config file exists
if not exist "tunnel-config\config.yaml" (
    echo ERROR: config.yaml not found in tunnel-config directory
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo ✅ config.yaml found
echo.

REM Check if credentials file exists
if not exist "tunnel-config\credentials.json" (
    echo ERROR: credentials.json not found in tunnel-config directory
    echo.
    echo Please run fix-tunnel-error-1033.bat to fix this issue
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo ✅ credentials.json found
echo.

echo Starting Cloudflare Tunnel with configuration...
echo Tunnel URL: https://lcsw.dpdns.org
echo.

REM Run the Cloudflare tunnel with verbose logging
echo Starting tunnel... (Press Ctrl+C to stop)
echo.
cloudflared tunnel --config tunnel-config\config.yaml --loglevel debug run

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Cloudflare tunnel failed to start (exit code: %errorlevel%)
    echo.
    echo Please check:
    echo 1. Your internet connection
    echo 2. That the tunnel ID in config.yaml matches credentials.json
    echo 3. That your Cloudflare account is active
    echo.
) else (
    echo.
    echo Cloudflare Tunnel has stopped.
)

echo Press any key to exit...
pause >nul