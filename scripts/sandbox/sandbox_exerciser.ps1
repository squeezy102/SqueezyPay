# SqueezyPay sandbox exerciser
# This script runs INSIDE Windows Sandbox.
# It installs SqueezyPay silently, starts the backend, exercises the API,
# and writes a JSON results file that the host reads back.
#
# Called by the .wsb LogonCommand.  Args are injected by the host via
# the mapped folder (C:\TestAssets\).

param(
    [string]$InstallerPath = "C:\TestAssets\SqueezyPay-Setup.exe",
    [string]$ResultsPath   = "C:\TestAssets\results.json"
)

$results = @{
    timestamp        = (Get-Date -Format "o")
    installer_found  = $false
    install_exit     = $null
    backend_started  = $false
    health_ok        = $false
    auth_configured  = $false
    setup_ok         = $false
    login_ok         = $false
    bills_ok         = $false
    errors           = @()
}

function Log($msg) { Write-Host "[EXERCISER] $msg" }
function Fail($msg) {
    $results.errors += $msg
    Log "FAIL: $msg"
}

# ---------------------------------------------------------------------------
# 1. Verify installer exists
# ---------------------------------------------------------------------------
if (-not (Test-Path $InstallerPath)) {
    Fail "Installer not found at $InstallerPath"
    $results | ConvertTo-Json | Out-File $ResultsPath -Encoding utf8
    exit 1
}
$results.installer_found = $true
Log "Installer found: $InstallerPath"

# ---------------------------------------------------------------------------
# 2. Run installer silently
#    /VERYSILENT      — no UI
#    /SUPPRESSMSGBOXES — suppress message boxes
#    /NORESTART       — don't reboot
#    /PLAID_SKIP      — no Plaid keys (we inject env vars manually)
#
#    The installer's Pascal code calls --generate-key to create keys,
#    writes them to HKCU\Environment, and writes initial_passphrase.tmp.
#    We inject a known passphrase via a pre-written tmp file instead.
# ---------------------------------------------------------------------------
Log "Writing initial passphrase bootstrap file..."
$appdataDir = "$env:APPDATA\SqueezyPay"
New-Item -ItemType Directory -Force -Path $appdataDir | Out-Null
"testpassphrase123" | Out-File "$appdataDir\initial_passphrase.tmp" -Encoding utf8 -NoNewline

Log "Running installer (silent)..."
$proc = Start-Process -FilePath $InstallerPath `
    -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" `
    -Wait -PassThru
$results.install_exit = $proc.ExitCode
if ($proc.ExitCode -ne 0) {
    Fail "Installer exited with code $($proc.ExitCode)"
    $results | ConvertTo-Json | Out-File $ResultsPath -Encoding utf8
    exit 1
}
Log "Installer completed (exit 0)"

# ---------------------------------------------------------------------------
# 3. Verify installation layout
# ---------------------------------------------------------------------------
$installDir = "$env:ProgramFiles\SqueezyPay"
if (-not (Test-Path $installDir)) {
    $installDir = "$env:LocalAppData\Programs\SqueezyPay"
}
$backendExe = "$installDir\backend.exe"
if (-not (Test-Path $backendExe)) {
    Fail "backend.exe not found at $backendExe"
    $results | ConvertTo-Json | Out-File $ResultsPath -Encoding utf8
    exit 1
}
Log "backend.exe found at $backendExe"

# ---------------------------------------------------------------------------
# 4. Verify env vars were written by installer
# ---------------------------------------------------------------------------
$encKey    = [System.Environment]::GetEnvironmentVariable("SQUEEZYPAY_ENCRYPTION_KEY", "User")
$secretKey = [System.Environment]::GetEnvironmentVariable("SQUEEZYPAY_SECRET_KEY", "User")
if (-not $encKey) { Fail "SQUEEZYPAY_ENCRYPTION_KEY not set in user environment" }
if (-not $secretKey) { Fail "SQUEEZYPAY_SECRET_KEY not set in user environment" }
Log "Env vars present: ENC_KEY=$(($encKey.Length) -gt 0), SECRET_KEY=$(($secretKey.Length) -gt 0)"

# Reload env so the backend child process inherits them
$env:SQUEEZYPAY_ENCRYPTION_KEY = $encKey
$env:SQUEEZYPAY_SECRET_KEY     = $secretKey

# ---------------------------------------------------------------------------
# 5. Start backend.exe
# ---------------------------------------------------------------------------
Log "Starting backend.exe..."
$backend = Start-Process -FilePath $backendExe `
    -WorkingDirectory $installDir `
    -PassThru -WindowStyle Hidden

# Wait for port 8000 to be listening (up to 30s)
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep 1
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
}

if (-not $ready) {
    Fail "Backend did not start within 30 seconds"
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    $results | ConvertTo-Json | Out-File $ResultsPath -Encoding utf8
    exit 1
}
$results.backend_started = $true
Log "Backend started and healthy"

# ---------------------------------------------------------------------------
# 6. Health check
# ---------------------------------------------------------------------------
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -UseBasicParsing
    if ($health.status -eq "ok") {
        $results.health_ok = $true
        Log "Health check: OK"
    } else {
        Fail "Health check returned unexpected status: $($health.status)"
    }
} catch {
    Fail "Health check failed: $_"
}

# ---------------------------------------------------------------------------
# 7. Auth status — should be configured (passphrase was bootstrapped)
# ---------------------------------------------------------------------------
Start-Sleep 2  # give the lifespan a moment to consume initial_passphrase.tmp
try {
    $authStatus = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/status" -UseBasicParsing
    if ($authStatus.configured -eq $true) {
        $results.auth_configured = $true
        Log "Auth: configured"
    } else {
        Fail "Auth not configured after bootstrap (configured=$($authStatus.configured))"
    }
} catch {
    Fail "Auth status check failed: $_"
}

# ---------------------------------------------------------------------------
# 8. Login
# ---------------------------------------------------------------------------
$token = $null
try {
    $loginBody = '{"passphrase":"testpassphrase123"}'
    $loginResp = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
        -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
    $token = $loginResp.access_token
    if ($token) {
        $results.login_ok = $true
        Log "Login: OK (token received)"
    } else {
        Fail "Login response had no access_token"
    }
} catch {
    Fail "Login failed: $_"
}

# ---------------------------------------------------------------------------
# 9. Authenticated API call — list bills (should return empty array)
# ---------------------------------------------------------------------------
if ($token) {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $bills = Invoke-RestMethod -Uri "http://localhost:8000/api/bills/" `
            -Headers $headers -UseBasicParsing
        # bills is an array — empty on fresh install is fine
        $results.bills_ok = $true
        Log "Bills endpoint: OK (count=$($bills.Count))"
    } catch {
        Fail "Bills endpoint failed: $_"
    }
}

# ---------------------------------------------------------------------------
# 10. Frontend served — check index.html
# ---------------------------------------------------------------------------
try {
    $spa = Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing -TimeoutSec 5
    if ($spa.StatusCode -eq 200 -and $spa.Content -match "SqueezyPay") {
        $results.spa_served = $true
        Log "SPA served: OK"
    } else {
        $results.spa_served = $false
        Fail "SPA root did not return expected content (status=$($spa.StatusCode))"
    }
} catch {
    $results.spa_served = $false
    Fail "SPA not served: $_"
}

# ---------------------------------------------------------------------------
# Done — write results and stop backend
# ---------------------------------------------------------------------------
Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
$results | ConvertTo-Json -Depth 5 | Out-File $ResultsPath -Encoding utf8
Log "Results written to $ResultsPath"
Log "Errors: $($results.errors.Count)"
exit $results.errors.Count
