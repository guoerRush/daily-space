$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env.feishu-worker"
$node = Join-Path $projectRoot ".tools\node-v22.23.1-win-x64\node.exe"
$worker = Join-Path $projectRoot "workers\feishu-long-connection.mjs"

if (-not (Test-Path -LiteralPath $envFile) -or -not (Test-Path -LiteralPath $node)) {
  exit 0
}
if (Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue) {
  exit 0
}

Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $value = $Matches[2].Trim()
    if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($value -ne "[SENSITIVE]") {
      Set-Item -Path "Env:$($Matches[1])" -Value $value
    }
  }
}
$savedAppId = [Environment]::GetEnvironmentVariable("DAILY_SPACE_FEISHU_APP_ID", "User")
$savedAppSecret = [Environment]::GetEnvironmentVariable("DAILY_SPACE_FEISHU_APP_SECRET", "User")
if ($savedAppId) { $env:FEISHU_APP_ID = $savedAppId }
if ($savedAppSecret) { $env:FEISHU_APP_SECRET = $savedAppSecret }
$env:DAILY_SPACE_INGEST_URL = "https://daily-space-six.vercel.app/api/feishu/events"
$env:PORT = "3010"
$outputLog = Join-Path $projectRoot "feishu-worker.out.log"
$errorLog = Join-Path $projectRoot "feishu-worker.err.log"
Start-Process -FilePath $node -ArgumentList "`"$worker`"" -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog
