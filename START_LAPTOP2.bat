@echo off
title ST-10 Laptop 2 Simulator

cd /d "%~dp0frontend"

echo ========================================
echo       ST-10 LAPTOP 2 SIMULATOR
echo ========================================
echo.
echo Project: %CD%
echo.

if not exist "package.json" (
    echo ERROR: package.json not found.
    echo Make sure this launcher is inside the Laptop 2 root folder.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies for the first time...
    npm install
    if errorlevel 1 (
        echo.
        echo npm install FAILED.
        pause
        exit /b 1
    )
)

echo.
echo Starting Laptop 2 frontend...
echo.
echo Browser: http://localhost:5173
echo Network: use the Vite Network URL for the other laptop.
echo.
echo Keep this window OPEN.
echo.

npm run dev -- --host 0.0.0.0

pause