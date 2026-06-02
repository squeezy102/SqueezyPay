# SqueezyPay Tray Launcher
# Target for the "SqueezyPay" desktop shortcut.
# Starts the system tray icon, which manages all three services.

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "backend\venv\Scripts\python.exe"
$trayScript = Join-Path $root "scripts\tray.py"
$adminRequirements = Join-Path $root "admin\requirements.txt"

# Install dependencies silently if needed (covers pystray, Pillow, requests)
& $python -m pip install -q -r $adminRequirements

# If tray.py is already running, do nothing — tray.py enforces single-instance
# via a named Windows mutex, so a second launch will exit immediately anyway.
# This check avoids the brief double-flash in the tray on rapid re-clicks.
$running = Get-Process -Name python -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*tray.py*" }
if ($running) { exit }

# Launch the tray icon hidden (no console window)
Start-Process -FilePath $python `
    -ArgumentList $trayScript `
    -WindowStyle Hidden
