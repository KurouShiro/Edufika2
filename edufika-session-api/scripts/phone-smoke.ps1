param(
    [string]$ApiBaseUrl = "http://localhost:8088",
    [string]$LaunchUrl = "https://docs.google.com/forms/d/e/EXAMPLE/viewform",
    [string]$RoleHint = "student"
)

$ErrorActionPreference = "Stop"
$base = $ApiBaseUrl.TrimEnd("/")

Write-Host "Edufika phone smoke test"
Write-Host "API base: $base"
Write-Host ""

Write-Host "1) Health check..."
$health = Invoke-RestMethod -Method GET -Uri "$base/health"
if (-not $health.ok) {
    throw "Health check failed."
}
Write-Host "   OK"

Write-Host "2) Create session..."
$createBody = @{
    proctor_id = "AdminID"
    token_count = 1
    launch_url = $LaunchUrl
} | ConvertTo-Json -Compress

$create = Invoke-RestMethod -Method POST -Uri "$base/session/create" -ContentType "application/json" -Body $createBody
Write-Host "   Session: $($create.session_id)"
Write-Host "   Token  : $($create.token)"

Write-Host "3) Claim token..."
$claimBody = @{
    token = $create.token
    device_fingerprint = "phone-smoke-device"
    role_hint = $RoleHint
} | ConvertTo-Json -Compress

$claim = Invoke-RestMethod -Method POST -Uri "$base/session/claim" -ContentType "application/json" -Body $claimBody
Write-Host "   Role    : $($claim.role)"
Write-Host "   Binding : $($claim.device_binding_id)"

Write-Host "4) Fetch launch config..."
$encodedSession = [uri]::EscapeDataString($claim.session_id)
$encodedSig = [uri]::EscapeDataString($claim.access_signature)
$launch = Invoke-RestMethod -Method GET -Uri "$base/exam/launch?session_id=$encodedSession&access_signature=$encodedSig"
Write-Host "   Launch URL : $($launch.launch_url)"
Write-Host "   Provider   : $($launch.provider)"

Write-Host "5) Send heartbeat..."
$heartbeatBody = @{
    session_id = $claim.session_id
    access_signature = $claim.access_signature
    device_binding_id = $claim.device_binding_id
    focus = $true
    multi_window = $false
    network_state = "stable"
    timestamp = [Int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
} | ConvertTo-Json -Compress

$heartbeat = Invoke-RestMethod -Method POST -Uri "$base/session/heartbeat" -ContentType "application/json" -Body $heartbeatBody
Write-Host "   Heartbeat status: $($heartbeat.status)"

Write-Host ""
Write-Host "Smoke test complete."
Write-Host "Use these values in Android testing:"
Write-Host "SESSION_ID        : $($claim.session_id)"
Write-Host "ACCESS_SIGNATURE  : $($claim.access_signature)"
Write-Host "DEVICE_BINDING_ID : $($claim.device_binding_id)"
Write-Host "LAUNCH_URL        : $($launch.launch_url)"
