# SqueezyPay Tray Launcher
# Target for the "SqueezyPay" desktop shortcut.
# Starts the system tray icon, which manages all three services.

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "backend\venv\Scripts\python.exe"
$trayScript = Join-Path $root "scripts\tray.py"
$adminRequirements = Join-Path $root "admin\requirements.txt"

# Install dependencies silently if needed (covers pystray, Pillow, requests)
& $python -m pip install -q -r $adminRequirements

# If the tray is already running (port 9000 listening), just open the dashboard
$listening = Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Start-Process "http://localhost:9000"
    exit
}

# Launch the tray icon hidden (no console window)
Start-Process -FilePath $python `
    -ArgumentList $trayScript `
    -WindowStyle Hidden
