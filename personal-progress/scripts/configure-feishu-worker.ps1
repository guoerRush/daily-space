$ErrorActionPreference = "Stop"

Write-Host "Daily Space 飞书长连接配置" -ForegroundColor Green
Write-Host "请从飞书开放平台 -> 凭证与基础信息复制 App ID 与 App Secret。"
$appId = Read-Host "App ID"
$secretInput = Read-Host "App Secret" -AsSecureString

if ([string]::IsNullOrWhiteSpace($appId) -or $secretInput.Length -eq 0) {
  throw "App ID 和 App Secret 不能为空。"
}

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretInput)
try {
  $appSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  [Environment]::SetEnvironmentVariable("DAILY_SPACE_FEISHU_APP_ID", $appId.Trim(), "User")
  [Environment]::SetEnvironmentVariable("DAILY_SPACE_FEISHU_APP_SECRET", $appSecret, "User")
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

& "$PSScriptRoot\start-feishu-long-connection.ps1"
Write-Host "配置已保存，飞书长连接正在启动。可以关闭此窗口。" -ForegroundColor Green
Read-Host "按 Enter 关闭"
