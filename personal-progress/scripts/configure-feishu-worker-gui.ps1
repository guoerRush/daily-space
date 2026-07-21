Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "Daily Space 飞书连接配置"
$form.Size = New-Object System.Drawing.Size(480, 270)
$form.StartPosition = "CenterScreen"
$form.TopMost = $true
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false

$description = New-Object System.Windows.Forms.Label
$description.Text = "在飞书开放平台 -> 凭证与基础信息中填写 App ID 和 App Secret。\nApp Secret 不会显示，也不会上传到 GitHub。"
$description.Location = New-Object System.Drawing.Point(28, 24)
$description.Size = New-Object System.Drawing.Size(420, 46)
$form.Controls.Add($description)

$appIdLabel = New-Object System.Windows.Forms.Label
$appIdLabel.Text = "App ID"
$appIdLabel.Location = New-Object System.Drawing.Point(28, 88)
$appIdLabel.Size = New-Object System.Drawing.Size(100, 24)
$form.Controls.Add($appIdLabel)

$appIdInput = New-Object System.Windows.Forms.TextBox
$appIdInput.Location = New-Object System.Drawing.Point(130, 84)
$appIdInput.Size = New-Object System.Drawing.Size(300, 26)
$form.Controls.Add($appIdInput)

$secretLabel = New-Object System.Windows.Forms.Label
$secretLabel.Text = "App Secret"
$secretLabel.Location = New-Object System.Drawing.Point(28, 130)
$secretLabel.Size = New-Object System.Drawing.Size(100, 24)
$form.Controls.Add($secretLabel)

$secretInput = New-Object System.Windows.Forms.TextBox
$secretInput.Location = New-Object System.Drawing.Point(130, 126)
$secretInput.Size = New-Object System.Drawing.Size(300, 26)
$secretInput.UseSystemPasswordChar = $true
$form.Controls.Add($secretInput)

$saveButton = New-Object System.Windows.Forms.Button
$saveButton.Text = "保存并启动飞书连接"
$saveButton.Location = New-Object System.Drawing.Point(224, 184)
$saveButton.Size = New-Object System.Drawing.Size(206, 36)
$form.Controls.Add($saveButton)
$form.AcceptButton = $saveButton

$saveButton.Add_Click({
  $appId = $appIdInput.Text.Trim()
  $appSecret = $secretInput.Text
  if ([string]::IsNullOrWhiteSpace($appId) -or [string]::IsNullOrWhiteSpace($appSecret)) {
    [System.Windows.Forms.MessageBox]::Show("App ID 和 App Secret 都不能为空。", "无法保存", "OK", "Warning")
    return
  }
  try {
    [Environment]::SetEnvironmentVariable("DAILY_SPACE_FEISHU_APP_ID", $appId, "User")
    [Environment]::SetEnvironmentVariable("DAILY_SPACE_FEISHU_APP_SECRET", $appSecret, "User")
    & "$PSScriptRoot\start-feishu-long-connection.ps1"
    $form.Close()
    [System.Windows.Forms.MessageBox]::Show("已保存并启动飞书连接。请等待几秒后回到网站生成绑定码。", "Daily Space", "OK", "Information")
  } catch {
    [System.Windows.Forms.MessageBox]::Show("启动失败：$($_.Exception.Message)", "Daily Space", "OK", "Error")
  }
})

[void][System.Windows.Forms.Application]::Run($form)
