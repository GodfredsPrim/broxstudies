@echo off
setlocal
if not exist "%~dp0start_system.ps1" (
    echo.
    echo ERROR: start_system.ps1 not found next to this .bat file.
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_system.ps1" %*
if %errorlevel% neq 0 (
    echo.
    echo Startup failed. See the message above.
    pause
    exit /b 1
)
echo.
echo Backend and frontend are running in their own windows:
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5175
echo This window will close on its own in a few seconds - closing it does NOT stop the servers.
timeout /t 8 /nobreak >nul
