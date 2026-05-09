param(
    [switch]$SkipInstall,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"

if ($BackendOnly -and $FrontendOnly) {
    throw "Use either -BackendOnly or -FrontendOnly, not both."
}

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendEnvFile = Join-Path $BackendDir ".env"
$BackendEnvExampleFile = Join-Path $BackendDir ".env.example"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-CommandExists {
    param([string]$CommandName)
    return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Start-InNewWindow {
    param(
        [string]$WindowTitle,
        [string]$WorkingDirectory,
        [string]$Command
    )

    Start-Process powershell -WorkingDirectory $WorkingDirectory -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$WindowTitle'; $Command"
    ) | Out-Null
}

Write-Step "Checking prerequisites"

if (-not (Test-CommandExists "python")) {
    throw "Python is required but was not found on PATH."
}

if (-not (Test-CommandExists "npm")) {
    throw "Node.js/npm is required but was not found on PATH."
}

if (-not (Test-Path $BackendEnvFile)) {
    Write-Step "Creating backend .env from template"
    Copy-Item $BackendEnvExampleFile $BackendEnvFile
    Write-Host "Created backend\\.env. Add your API keys before using AI features." -ForegroundColor Yellow
}

if (-not $SkipInstall) {
    if (-not $FrontendOnly) {
        Write-Step "Installing backend dependencies"
        python -m pip install -r (Join-Path $BackendDir "requirements.txt")
    }

    if (-not $BackendOnly) {
        Write-Step "Installing frontend dependencies"
        npm install --prefix $FrontendDir
    }
}

if (-not $FrontendOnly) {
    Write-Step "Starting backend server"
    Start-InNewWindow `
        -WindowTitle "BisaME Backend" `
        -WorkingDirectory $BackendDir `
        -Command "uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
}

if (-not $BackendOnly) {
    Write-Step "Starting frontend server"
    Start-InNewWindow `
        -WindowTitle "BisaME Frontend" `
        -WorkingDirectory $FrontendDir `
        -Command "npm run dev"
}

Write-Step "System startup requested"
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5175" -ForegroundColor Green
Write-Host "API docs: http://localhost:8000/docs" -ForegroundColor Green
