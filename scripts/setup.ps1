# SqueezyPay First-Time Setup
# Run this once after cloning the repository.
# Creates the Python environment, installs all dependencies, and initialises the database.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-Done($msg) {
    Write-Host "    OK: $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host ""
    Write-Host "ERROR: $msg" -ForegroundColor Red
    Write-Host ""
    Write-Host "If you are stuck, see the Troubleshooting page:" -ForegroundColor Yellow
    Write-Host "  https://github.com/squeezy102/SqueezyPay/wiki/Troubleshooting" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor White
Write-Host "  SqueezyPay Setup" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor White

# --- Python ---
Write-Step "Checking Python..."
try {
    $pyver = python --version 2>&1
    Write-Done $pyver
} catch {
    Write-Fail "Python was not found. Install it from https://www.python.org/downloads/ and make sure to check 'Add Python to PATH' during installation."
}

# --- Node ---
Write-Step "Checking Node.js..."
try {
    $nodever = node --version 2>&1
    Write-Done "Node.js $nodever"
} catch {
    Write-Fail "Node.js was not found. Install the LTS version from https://nodejs.org and restart your computer, then run this script again."
}

# --- Backend venv ---
Write-Step "Creating Python virtual environment..."
$venv = Join-Path $root "backend\venv"
if (-not (Test-Path $venv)) {
    python -m venv $venv
    if (-not $?) { Write-Fail "Failed to create virtual environment." }
} else {
    Write-Host "    (already exists, skipping)"
}
Write-Done "Virtual environment ready"

# --- Backend dependencies ---
Write-Step "Installing backend dependencies (this may take a minute)..."
$pip = Join-Path $venv "Scripts\pip.exe"
& $pip install -q -r (Join-Path $root "backend\requirements.txt")
if (-not $?) { Write-Fail "pip install failed. Check your internet connection and try again." }
Write-Done "Backend dependencies installed"

# --- Database ---
Write-Step "Initialising database..."
$python = Join-Path $venv "Scripts\python.exe"
Push-Location (Join-Path $root "backend")
& $python -m alembic upgrade head
if (-not $?) {
    Pop-Location
    Write-Fail "Database migration failed."
}
Pop-Location
Write-Done "Database ready"

# --- Frontend dependencies ---
Write-Step "Installing frontend dependencies (this may take a minute)..."
Push-Location (Join-Path $root "frontend")
npm install --silent
if (-not $?) {
    Pop-Location
    Write-Fail "npm install failed. Make sure Node.js is installed and try again."
}
Pop-Location
Write-Done "Frontend dependencies installed"

# --- Done ---
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: generate your security keys." -ForegroundColor White
Write-Host ""
Write-Host "Run this command:" -ForegroundColor White
Write-Host "  cd backend" -ForegroundColor Yellow
Write-Host "  .\venv\Scripts\python.exe scripts\generate_key.py" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then follow the Getting Started guide to store your keys and create a shortcut." -ForegroundColor White
Write-Host "  https://github.com/squeezy102/SqueezyPay/wiki/Getting-Started" -ForegroundColor Cyan
Write-Host ""
