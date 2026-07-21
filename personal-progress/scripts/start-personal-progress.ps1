$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$node = Join-Path $projectRoot ".tools\node-v22.23.1-win-x64\node.exe"
$next = Join-Path $projectRoot "node_modules\next\dist\bin\next"

if (-not (Test-Path -LiteralPath $node) -or -not (Test-Path -LiteralPath $next)) {
  exit 1
}

# A service already listening on the local website port wins. This keeps
# repeated Windows login events from creating another Next.js process.
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  exit 0
}

Start-Process -FilePath $node -ArgumentList "`"$next`" start --hostname 127.0.0.1 --port 3000" -WorkingDirectory $projectRoot -WindowStyle Hidden
Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\start-feishu-long-connection.ps1`"" -WindowStyle Hidden
