param(
    [switch]$CleanBuild
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$schemaAdminDir = Join-Path $root "schema-admin"
$buildScript = Join-Path $schemaAdminDir "build.ps1"
$exePath = Join-Path $schemaAdminDir "dist\\EdufikaSchemaAdmin.exe"

if (!(Test-Path $schemaAdminDir)) {
    throw "schema-admin directory not found at: $schemaAdminDir"
}

if (!(Test-Path $buildScript)) {
    throw "Build script not found at: $buildScript"
}

if ($CleanBuild -or !(Test-Path $exePath)) {
    Write-Host "Building EdufikaSchemaAdmin..."
    if ($CleanBuild) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $buildScript -Clean
    } else {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $buildScript
    }
}

if (!(Test-Path $exePath)) {
    throw "Build finished but EXE was not found: $exePath"
}

Write-Host "Launching EdufikaSchemaAdmin..."
Start-Process -FilePath $exePath
