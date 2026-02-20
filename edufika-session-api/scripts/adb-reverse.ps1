param(
    [int]$Port = 8088
)

$ErrorActionPreference = "Stop"

function Resolve-AdbPath {
    $candidatePaths = @()

    $projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
    $localProperties = Join-Path $projectRoot "local.properties"
    if (Test-Path $localProperties) {
        $line = Get-Content $localProperties | Where-Object { $_ -match "^sdk\.dir=" } | Select-Object -First 1
        if ($line) {
            $sdkRaw = $line.Substring("sdk.dir=".Length)
            $sdkPath = $sdkRaw -replace "\\\\", "\"
            $sdkPath = $sdkPath -replace "\\:", ":"
            $candidatePaths += (Join-Path $sdkPath "platform-tools\adb.exe")
        }
    }

    $candidatePaths += "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

    foreach ($path in $candidatePaths) {
        if ($path -and (Test-Path $path)) {
            return $path
        }
    }

    return $null
}

$adbPath = Resolve-AdbPath
if (-not $adbPath) {
    throw "adb.exe not found. Install Android SDK platform-tools or set up Android Studio SDK."
}

Write-Host "Using adb at: $adbPath"

& $adbPath start-server | Out-Null
$devicesOutput = & $adbPath devices
$onlineDevices = $devicesOutput | Where-Object { $_ -match "device$" } | ForEach-Object { $_.Split("`t")[0] }

if (-not $onlineDevices -or $onlineDevices.Count -eq 0) {
    Write-Host ""
    Write-Host "No authorized device found."
    Write-Host "1) Enable Developer Options + USB Debugging on phone."
    Write-Host "2) Connect phone by USB."
    Write-Host "3) Accept RSA prompt (Always allow)."
    Write-Host "4) Re-run this script."
    exit 1
}

Write-Host "Connected devices: $($onlineDevices -join ', ')"

foreach ($serial in $onlineDevices) {
    & $adbPath -s $serial reverse "tcp:$Port" "tcp:$Port" | Out-Null
    Write-Host "adb reverse set for ${serial}: tcp:$Port -> tcp:$Port"
}

Write-Host ""
Write-Host "Set Android app Server API URL to: http://127.0.0.1:$Port"
