# SqueezyPay Auto-Start Script
# Runs on Windows login via Task Scheduler. Starts the admin server silently.
# Does NOT open a browser - use the desktop shortcut or navigate manually.

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "backend\venv\Scripts\python.exe"
$adminDir = Join-Path $root "admin"
$port = 9000

# If already running, nothing to do
$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    exit 0
}

# Start admin server hidden - no console window
$serverArgs = "-m uvicorn main:app --host 0.0.0.0 --port $port"
Start-Process -FilePath $python `
    -ArgumentList $serverArgs.Split(" ") `
    -WorkingDirectory $adminDir `
    -WindowStyle Hidden
