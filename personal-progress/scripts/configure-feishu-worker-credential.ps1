$ErrorActionPreference = "Stop"

Write-Host "Daily Space Feishu setup" -ForegroundColor Green
Write-Host "Use the Windows credential dialog that opens next."
Write-Host "User name: Feishu App ID. Password: Feishu App Secret."

$credential = Get-Credential -Message "Daily Space Feishu: user name is App ID, password is App Secret"
if ($null -eq $credential -or [string]::IsNullOrWhiteSpace($credential.UserName)) {
  throw "App ID is required."
}

$appId = $credential.UserName.Trim()
$appSecret = $credential.GetNetworkCredential().Password
if ([string]::IsNullOrWhiteSpace($appSecret)) {
  throw "App Secret is required."
}

[Environment]::SetEnvironmentVariable("DAILY_SPACE_FEISHU_APP_ID", $appId, "User")
[Environment]::SetEnvironmentVariable("DAILY_SPACE_FEISHU_APP_SECRET", $appSecret, "User")

& "$PSScriptRoot\start-feishu-long-connection.ps1"
Write-Host "Saved. The Feishu worker is starting in the background." -ForegroundColor Green
Read-Host "Press Enter to close this window"
