# SqueezyPay Admin Dashboard Launcher
# Double-click the desktop shortcut to run this.

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "backend\venv\Scripts\python.exe"
$adminDir = Join-Path $root "admin"
$port = 9000
$url = "http://localhost:$port"

# If already running, just open the browser
$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Write-Host "Admin dashboard already running - opening browser..."
    Start-Process $url
    exit
}

Write-Host ""
Write-Host "========================================="
Write-Host "  SqueezyPay Admin Dashboard"
Write-Host "========================================="
Write-Host ""
Write-Host "Starting the admin server..."
Write-Host "A separate server window will open - that's normal, leave it running."
Write-Host ""

# Install admin dependencies silently if needed
& $python -m pip install -q -r (Join-Path $adminDir "requirements.txt")

# Start the admin server in a normal (visible) maximized window
$serverArgs = "-m uvicorn main:app --host 0.0.0.0 --port $port"
$proc = Start-Process -FilePath $python `
    -ArgumentList $serverArgs.Split(" ") `
    -WorkingDirectory $adminDir `
    -WindowStyle Normal `
    -PassThru

# Bring the server window to focus
Start-Sleep -Milliseconds 500
if ($proc -and !$proc.HasExited) {
    $sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
    $type = Add-Type -MemberDefinition $sig -Name Win32 -Namespace SetFG -PassThru -ErrorAction SilentlyContinue
    if ($type -and $proc.MainWindowHandle -ne [IntPtr]::Zero) {
        $type::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
    }
}

Write-Host "Waiting for server to be ready..."

# Wait up to 15 seconds for the server to respond
$maxRetries = 30
$retryDelayMs = 500
$ready = $false
for ($i = 0; $i -lt $maxRetries; $i++) {
    Start-Sleep -Milliseconds $retryDelayMs
    $result = curl.exe -s -o NUL -w "%{http_code}" --max-time 1 "$url/api/status" 2>$null
    if ($result -eq "200") {
        $ready = $true
        break
    }
}

if ($ready) {
    Write-Host "Server is ready! Opening browser..."
    Write-Host ""
    Write-Host "Dashboard: $url"
    Write-Host ""
    Start-Process $url
} else {
    Write-Host ""
    Write-Host "Server is taking longer than expected."
    Write-Host "Try opening this URL manually in your browser:"
    Write-Host "  $url"
    Write-Host ""
}
