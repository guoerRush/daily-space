@echo off
setlocal
cd /d "%~dp0.."

:restart
echo [%date% %time%] Starting Personal Progress on http://localhost:3000 >> "dev-server.out.log"
".tools\node-v22.23.1-win-x64\node.exe" "node_modules\next\dist\bin\next" start --hostname 127.0.0.1 --port 3000 >> "dev-server.out.log" 2>> "dev-server.err.log"
echo [%date% %time%] Server exited. Retrying in 5 seconds. >> "dev-server.err.log"
timeout /t 5 /nobreak >nul
goto restart
