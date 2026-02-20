param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if ($Clean) {
    Remove-Item -Recurse -Force build, dist, __pycache__ -ErrorAction SilentlyContinue
    Remove-Item -Force EdufikaSchemaAdmin.spec -ErrorAction SilentlyContinue
}

if (!(Test-Path ".venv")) {
    py -3 -m venv .venv
}

$python = Join-Path $root ".venv\\Scripts\\python.exe"
$pyinstaller = Join-Path $root ".venv\\Scripts\\pyinstaller.exe"

& $python -m pip install --upgrade pip
& $python -m pip install -r requirements.txt pyinstaller

& $pyinstaller `
    --noconfirm `
    --clean `
    --onefile `
    --windowed `
    --name EdufikaSchemaAdmin `
    app.py

Write-Host ""
Write-Host "Build complete:"
Write-Host "  $root\\dist\\EdufikaSchemaAdmin.exe"
