@echo off
REM Messaging Module - Dashboard Restart Script (Windows)
REM This script helps restart the Vite dev server with cache clearing

echo.
echo ===========================================
echo   Restarting Dashboard Dev Server
echo ===========================================
echo.

cd /d "%~dp0dashboard"

REM Check if port 5173 is in use
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [*] Stopping existing dev server on port 5173...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

REM Clear Vite cache
if exist "node_modules\.vite\" (
    echo [*] Clearing Vite cache...
    rmdir /s /q "node_modules\.vite" 2>nul
)

REM Start dev server
echo [*] Starting dev server...
echo.
call npm run dev

