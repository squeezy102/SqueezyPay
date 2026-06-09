# Run this once to register SqueezyPay as a Windows login auto-start task.
# Requires running as Administrator (right-click PowerShell -> Run as Administrator).

$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root "scripts\launch-tray.ps1"
$taskName = "SqueezyPay"

# Remove existing task if present (clean re-register)
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
    -StartWhenAvailable `
    -DontStopOnIdleEnd

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Description "Starts the SqueezyPay tray icon on login, which manages all services." | Out-Null

Write-Host ""
Write-Host "========================================="
Write-Host "  SqueezyPay Auto-Start Registered"
Write-Host "  (Task name: SqueezyPay)"
Write-Host "========================================="
Write-Host ""
Write-Host "Task name : $taskName"
Write-Host "Runs as   : $env:USERNAME"
Write-Host "Trigger   : On login"
Write-Host ""
Write-Host "The tray icon will appear automatically next time you log in."
Write-Host "Right-click the tray icon to start/stop services or open the dashboard."
Write-Host ""
Write-Host "To remove auto-start, run:"
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
Write-Host ""
