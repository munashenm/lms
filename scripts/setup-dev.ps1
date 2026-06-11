# SchoolHub SA — local dev database setup (Windows)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "SchoolHub SA — Dev Setup" -ForegroundColor Cyan
Write-Host ""

# Check port 5432
$portOpen = (Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded

if (-not $portOpen) {
    Write-Host "PostgreSQL is NOT running on port 5432." -ForegroundColor Red
    Write-Host ""
    Write-Host "Choose one option:" -ForegroundColor Yellow
    Write-Host "  A) Docker Desktop (recommended)"
    Write-Host "     1. Install from https://www.docker.com/products/docker-desktop/"
    Write-Host "     2. Run: docker compose up -d"
    Write-Host ""
    Write-Host "  B) PostgreSQL 16 for Windows"
    Write-Host "     1. Install from https://www.postgresql.org/download/windows/"
    Write-Host "     2. Use password: password, port: 5432"
    Write-Host "     3. Create database: schoolhub_sa"
    Write-Host ""
    Write-Host "  C) Free cloud DB (Neon/Supabase)"
    Write-Host "     1. Create a free PostgreSQL database"
    Write-Host "     2. Update DATABASE_URL in .env"
    Write-Host ""
    exit 1
}

Write-Host "Database port 5432 is open." -ForegroundColor Green

Write-Host "Pushing schema..." -ForegroundColor Cyan
npm run db:push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Seeding demo data..." -ForegroundColor Cyan
npm run db:seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Ready! Start the app with: npm run dev" -ForegroundColor Green
Write-Host "Login: admin@college.co.za / admin123" -ForegroundColor Green
