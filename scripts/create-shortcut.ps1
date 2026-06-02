# Run this once to create the SqueezyPay desktop shortcut.
# After running, a "SqueezyPay" shortcut will appear on your desktop.
# Double-clicking it launches the tray icon, which manages all services.

$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $root "scripts\launch-tray.ps1"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "SqueezyPay.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
$shortcut.WorkingDirectory = $root
$shortcut.Description = "Start SqueezyPay"
$shortcut.IconLocation = "shell32.dll,13"
$shortcut.WindowStyle = 7  # minimized - no console flash
$shortcut.Save()

Write-Host "Shortcut created at: $shortcutPath"
Write-Host "Double-click 'SqueezyPay' on your desktop to launch the tray icon."
