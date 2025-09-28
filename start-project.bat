@echo off
title WhatsApp Commerce Hub - Starting...

echo ==========================================
echo   WhatsApp Commerce Hub - Start Script
echo ==========================================
echo.

REM Check if the app is already running
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo WARNING: Node.js processes are already running
    echo.
)

echo Starting WhatsApp Commerce Hub...
echo This may take a few moments...
echo.

REM Navigate to the app directory and start the development server
cd /d "%~dp0"
echo Starting development server on port 3000...
start "WhatsApp Commerce Hub Server" cmd /k "yarn dev:no-reload"

timeout /t 3 /nobreak >nul

echo.
echo ==========================================
echo   Server starting...
echo   Local URL: http://localhost:3000
echo   Webhook URL: https://lcsw.dpdns.org/api/webhook/shopify
echo ==========================================
echo.
echo To access your application from the internet:
echo 1. Make sure your Cloudflare tunnel is running (start-tunnel.bat)
echo 2. Verify tunnel status at: https://dash.cloudflare.com
echo.
echo The server will continue running in the background.
echo To stop the server, run stop-project.bat
echo.
echo Press any key to exit this window...
pause >nul