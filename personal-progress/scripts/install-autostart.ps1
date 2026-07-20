$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectRoot "scripts\start-personal-progress.cmd"
$taskName = "DailySpacePersonalProgress"

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Missing launcher: $launcher"
}

# The launcher stays alive and restarts Next.js itself if it exits. Keeping
# the executable and its argument separate prevents spaces in the path from
# being misread by the Windows task command parser.
try {
  $action = New-ScheduledTaskAction -Execute $env:ComSpec -Argument "/c `"$launcher`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Days 3650) -StartWhenAvailable -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Limited -Force | Out-Null
  Start-ScheduledTask -TaskName $taskName
  $method = "Windows Task Scheduler"
} catch {
  # Some managed Windows installations prohibit user-created tasks. The Run
  # key is per-user and starts the same resilient launcher after each login.
  $runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
  $runCommand = "`"$env:ComSpec`" /c `"$launcher`""
  New-Item -Path $runKey -Force | Out-Null
  Set-ItemProperty -Path $runKey -Name $taskName -Value $runCommand
  $method = "Windows login startup"
}

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  Start-Process -FilePath $env:ComSpec -ArgumentList "/c `"$launcher`"" -WindowStyle Hidden
}

Write-Output "Autostart is installed with $method. Open http://localhost:3000 after a few seconds."
