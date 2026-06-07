#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Enables Windows Sandbox on this machine.

.DESCRIPTION
    Windows Sandbox is built into Windows 10/11 Pro and Enterprise.
    It provides a lightweight, isolated VM that resets to a clean state on every run.
    A reboot is required after enabling.

.NOTES
    Run this script once as Administrator, then reboot.
    After reboot, run run_sandbox_test.py to test the SqueezyPay installer.
#>

$feature = Get-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -ErrorAction SilentlyContinue

if ($feature -and $feature.State -eq "Enabled") {
    Write-Host "Windows Sandbox is already enabled." -ForegroundColor Green
    exit 0
}

Write-Host "Enabling Windows Sandbox..." -ForegroundColor Cyan
$result = Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All -NoRestart

if ($result.RestartNeeded) {
    Write-Host ""
    Write-Host "Windows Sandbox has been enabled." -ForegroundColor Green
    Write-Host "A REBOOT IS REQUIRED before you can use Windows Sandbox." -ForegroundColor Yellow
    Write-Host ""
    $reboot = Read-Host "Reboot now? (y/N)"
    if ($reboot -eq "y" -or $reboot -eq "Y") {
        Restart-Computer -Force
    } else {
        Write-Host "Please reboot manually before running the sandbox test." -ForegroundColor Yellow
    }
} else {
    Write-Host "Windows Sandbox enabled (no reboot required)." -ForegroundColor Green
}
