@echo off
setlocal

set "LOCK_DIR=%TEMP%\DailySpacePersonalProgress.lock"
mkdir "%LOCK_DIR%" 2>nul
if errorlevel 1 exit /b 0

cd /d "%~dp0.."

rem A manually started server already owns the website. Do not compete with it.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  rmdir "%LOCK_DIR%" 2>nul
  exit /b 0
)

:restart
echo [%date% %time%] Starting Personal Progress on http://localhost:3000 >> "dev-server.out.log"
".tools\node-v22.23.1-win-x64\node.exe" "node_modules\next\dist\bin\next" start --hostname 127.0.0.1 --port 3000 >> "dev-server.out.log" 2>> "dev-server.err.log"

rem If another server claimed the port after this process exited, leave it alone.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  rmdir "%LOCK_DIR%" 2>nul
  exit /b 0
)

echo [%date% %time%] Server exited. Retrying in 5 seconds. >> "dev-server.err.log"
timeout /t 5 /nobreak >nul
goto restart
