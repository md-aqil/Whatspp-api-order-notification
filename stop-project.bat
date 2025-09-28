@echo off
setlocal enabledelayedexpansion
title WhatsApp Commerce Hub - Stopping...

echo ==========================================
echo   WhatsApp Commerce Hub - Stop Script
echo ==========================================
echo.

echo Searching for running Node.js processes...
echo.

REM Find and kill Node.js processes associated with the project
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv 2^>nul ^| findstr /i "node.exe"') do (
    echo Found Node.js process: %%i
    taskkill /PID %%i /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo Successfully terminated process %%i
    ) else (
        echo Failed to terminate process %%i
    )
)

echo.
echo Searching for processes on port 3001...
echo.

REM Find and kill any processes using port 3001
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3001') do (
    echo Found process on port 3001: %%i
    taskkill /PID %%i /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo Successfully terminated process %%i
    ) else (
        echo Failed to terminate process %%i
    )
)

echo.
echo ==========================================
echo   WhatsApp Commerce Hub stopped
echo ==========================================
echo.
echo All related processes have been terminated.
echo.
echo Press any key to exit...
pause >nul