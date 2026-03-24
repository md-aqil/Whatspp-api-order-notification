@echo off
title WhatsApp Commerce Hub - Starting App & Tunnel

echo ==========================================
echo   WhatsApp Commerce Hub - Starting Everything
echo ==========================================
echo.

REM Check if npm/node is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if cloudflared is installed
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: cloudflared is not installed
    echo.
    echo Please install cloudflared:
    echo   macOS: brew install cloudflared
    echo   Windows: Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
    echo.
    pause
    exit /b 1
)

echo ✅ npm and cloudflared are installed
echo.

REM Check if config file exists
if not exist "tunnel-config\config.yaml" (
    echo ERROR: config.yaml not found
    echo Please run setup-cloudflare-tunnel.bat first
    echo.
    pause
    exit /b 1
)

REM Check if credentials file exists
if not exist "tunnel-config\credentials.json" (
    echo ERROR: credentials.json not found
    echo Please run setup-cloudflare-tunnel.bat first
    echo.
    pause
    exit /b 1
)

echo ✅ Configuration files found
echo.

echo ==========================================
echo Starting Next.js app and Cloudflare Tunnel
echo ==========================================
echo.
echo Next.js will start on http://localhost:3000
echo Tunnel URL: https://lcsw.dpdns.org
echo.
echo Press Ctrl+C to stop everything
echo.

REM Start both Next.js and tunnel
REM Using start /B to run both in background
start "Next.js" cmd /k "npm run dev"
timeout /t 10 /nobreak >nul
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --config tunnel-config\config.yaml run"

echo.
echo Both services should be starting...
echo.
echo If the tunnel doesn't connect, make sure Next.js is running first
echo.