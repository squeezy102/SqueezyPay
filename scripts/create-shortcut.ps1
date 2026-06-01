# Run this once to create the SqueezyPay desktop shortcut.
# After running, a "SqueezyPay Admin" shortcut will appear on your desktop.

$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $root "scripts\launch-admin.ps1"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "SqueezyPay Admin.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$launcher`""
$shortcut.WorkingDirectory = $root
$shortcut.Description = "Start SqueezyPay Admin Dashboard"
$shortcut.IconLocation = "shell32.dll,13"
$shortcut.WindowStyle = 1
$shortcut.Save()

Write-Host "Shortcut created at: $shortcutPath"
Write-Host "Double-click 'SqueezyPay Admin' on your desktop to launch the dashboard."
