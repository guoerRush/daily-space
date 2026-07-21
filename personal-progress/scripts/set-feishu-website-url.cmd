@echo off
set /p APP_URL=Paste the deployed website URL, for example https://daily-space.example.com: 
if "%APP_URL%"=="" exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('DAILY_SPACE_INGEST_URL', '%APP_URL%', 'User')"
echo Saved. Restart the Feishu worker to use the new website address.
pause
