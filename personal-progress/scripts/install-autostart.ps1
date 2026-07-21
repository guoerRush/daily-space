$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectRoot "scripts\start-personal-progress.cmd"
$hiddenLauncher = Join-Path $projectRoot "scripts\start-personal-progress.ps1"
$taskName = "DailySpacePersonalProgress"

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Missing launcher: $launcher"
}
if (-not (Test-Path -LiteralPath $hiddenLauncher)) {
  throw "Missing hidden launcher: $hiddenLauncher"
}

# The launcher stays alive and restarts Next.js itself if it exits. Keeping
# the executable and its argument separate prevents spaces in the path from
# being misread by the Windows task command parser.
try {
  $action = New-ScheduledTaskAction -Execute $env:ComSpec -Argument "/c `"$launcher`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Days 3650) -StartWhenAvailable -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Limited -Force | Out-Null
  $method = "Windows Task Scheduler"
} catch {
  # Some managed Windows installations prohibit user-created tasks. The Run
  # key is per-user and starts the same resilient launcher after each login.
  $runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
  $runCommand = "`"$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe`" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$hiddenLauncher`""
  New-Item -Path $runKey -Force | Out-Null
  Set-ItemProperty -Path $runKey -Name $taskName -Value $runCommand
  $method = "Windows login startup"
}

Write-Output "Autostart is installed with $method. It starts once at the next sign-in."
