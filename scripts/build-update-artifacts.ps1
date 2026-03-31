param(
    [ValidateSet("stable", "debug")]
    [string]$Channel = "stable",
    [string]$BaseUrl = "https://srv1536310.hstgr.cloud"
)

$ErrorActionPreference = "Stop"

function Require-File {
    param(
        [string]$Path,
        [string]$Message
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw $Message
    }
}

function Find-LatestApk {
    param([string]$DirectoryPath)

    $apk = Get-ChildItem -LiteralPath $DirectoryPath -Filter *.apk -File |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if ($null -eq $apk) {
        throw "No APK was found in $DirectoryPath."
    }

    return $apk
}

function Read-OutputMetadata {
    param([string]$MetadataPath)

    if (-not (Test-Path -LiteralPath $MetadataPath -PathType Leaf)) {
        return $null
    }

    return Get-Content -LiteralPath $MetadataPath -Raw | ConvertFrom-Json
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$workspaceRoot = (Resolve-Path (Join-Path $repoRoot "..")).Path
$gradleWrapper = Join-Path $repoRoot "gradlew.bat"
$appDir = Join-Path $repoRoot "app"
$buildType = if ($Channel -eq "stable") { "release" } else { "debug" }
$channelPackageName = if ($Channel -eq "stable") {
    "com.techivibes.edufika"
} else {
    "com.techivibes.edufika.debug"
}
$otaFileName = if ($Channel -eq "stable") {
    "edufika-rn-stable-update.zip"
} else {
    "edufika-rn-debug-update.zip"
}
$apkTargetName = if ($Channel -eq "stable") { "app-release.apk" } else { "app-debug.apk" }
$artifactOutputDir = Join-Path $appDir "build\outputs\updates\$Channel"
$payloadDir = Join-Path $artifactOutputDir "ota-payload"
$otaZipPath = Join-Path $artifactOutputDir $otaFileName
$apkOutputPath = Join-Path $artifactOutputDir $apkTargetName
$snippetPath = Join-Path $artifactOutputDir "manifest-snippet.$Channel.json"
$tmpDir = Join-Path $workspaceRoot ".tmp"
$gradleHome = Join-Path $workspaceRoot ".gradle-home"
$bundlePath = Join-Path $appDir "build\generated\assets\react\$buildType\index.android.bundle"
$bundleAssetsDir = Join-Path $appDir "build\generated\res\react\$buildType"
$apkDirectory = Join-Path $appDir "build\outputs\apk\$buildType"
$metadataPath = Join-Path $apkDirectory "output-metadata.json"
$gradleTasks = if ($Channel -eq "stable") {
    @("assembleTesterRelease")
} else {
    @("assembleDebug")
}

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null

$env:GRADLE_USER_HOME = $gradleHome
$env:TEMP = $tmpDir
$env:TMP = $tmpDir

Push-Location $repoRoot
try {
    $gradleTaskString = $gradleTasks -join " "
    & cmd.exe /d /c "`"$gradleWrapper`" $gradleTaskString"
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle failed while building the $Channel channel artifacts."
    }
} finally {
    Pop-Location
}

Require-File -Path $bundlePath -Message "React Native bundle not found at $bundlePath."

if (Test-Path -LiteralPath $artifactOutputDir) {
    Remove-Item -LiteralPath $artifactOutputDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null
Copy-Item -LiteralPath $bundlePath -Destination (Join-Path $payloadDir "index.android.bundle") -Force

if (Test-Path -LiteralPath $bundleAssetsDir) {
    $payloadAssetsDir = Join-Path $payloadDir "assets"
    New-Item -ItemType Directory -Force -Path $payloadAssetsDir | Out-Null
    Get-ChildItem -LiteralPath $bundleAssetsDir | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $payloadAssetsDir -Recurse -Force
    }
}

Compress-Archive -Path (Join-Path $payloadDir "*") -DestinationPath $otaZipPath -Force

$apkFile = Find-LatestApk -DirectoryPath $apkDirectory
Copy-Item -LiteralPath $apkFile.FullName -Destination $apkOutputPath -Force

$otaSha256 = (Get-FileHash -LiteralPath $otaZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$apkSha256 = (Get-FileHash -LiteralPath $apkOutputPath -Algorithm SHA256).Hash.ToLowerInvariant()
$metadata = Read-OutputMetadata -MetadataPath $metadataPath
$metadataEntry = $null
if ($metadata -and $metadata.elements -and $metadata.elements.Count -gt 0) {
    $metadataEntry = $metadata.elements[0]
}
$versionCode = if ($metadataEntry -and $metadataEntry.PSObject.Properties.Name -contains "versionCode") {
    [int]$metadataEntry.versionCode
} else {
    0
}
$versionName = if ($metadataEntry -and $metadataEntry.PSObject.Properties.Name -contains "versionName") {
    [string]$metadataEntry.versionName
} else {
    "0.0.0"
}
$generatedAt = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$otaVersion = "{0}-{1}" -f ([DateTime]::UtcNow.ToString("yyyy.MM.dd-HHmm")), $Channel
$baseUrlNormalized = $BaseUrl.Trim().TrimEnd("/")
$snippetObject = [ordered]@{
    channel = $Channel
    generatedAt = $generatedAt
    remoteConfig = [ordered]@{
        version = [DateTime]::UtcNow.ToString("yyyy.MM.dd.HHmm")
        values = [ordered]@{
            defaultBackendBaseUrl = $baseUrlNormalized
        }
    }
    ota = [ordered]@{
        version = $otaVersion
        mandatory = $false
        minNativeVersionCode = $versionCode
        bundleUrl = "/updates/files/ota/$otaFileName"
        sha256 = $otaSha256
        notes = "React Native OTA package for the $Channel channel."
    }
    native = [ordered]@{
        versionCode = $versionCode
        versionName = $versionName
        mandatory = $false
        apkUrl = "/updates/files/native/$apkTargetName"
        packageName = $channelPackageName
        sha256 = $apkSha256
        notes = "Native APK package for the $Channel channel."
    }
}

$snippetObject | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $snippetPath -Encoding utf8

Write-Host ""
Write-Host "Channel            : $Channel"
Write-Host "APK                : $apkOutputPath"
Write-Host "OTA zip            : $otaZipPath"
Write-Host "Manifest snippet   : $snippetPath"
Write-Host "APK SHA-256        : $apkSha256"
Write-Host "OTA SHA-256        : $otaSha256"
Write-Host ""
Write-Host "Copy the files above into edufika-session-api/updates/files on the server,"
Write-Host "then merge the generated manifest snippet into the channel manifest."
