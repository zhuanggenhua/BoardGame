param(
  [string]$HostName = "admin@8.148.71.102",
  [string]$ProjectDir = "/home/admin/BoardGame",
  [string]$Tag = "",
  [ValidateSet("stream", "remote")]
  [string]$DeployMode = "stream",
  [string]$OtaChannel = "stable",
  [string]$OtaExtra = "",
  [switch]$SkipOta,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$nodeArgs = @(
  "scripts/release/deploy-and-ota.mjs",
  "--skip-wait",
  "--host", $HostName,
  "--remote-dir", $ProjectDir,
  "--deploy-mode", $DeployMode,
  "--ota-channel", $OtaChannel
)

if ($Tag) {
  $nodeArgs += @("--deploy-tag", $Tag)
}

if ($OtaExtra) {
  $nodeArgs += @("--ota-extra", $OtaExtra)
}

if ($SkipOta) {
  $nodeArgs += @("--skip-ota")
}

if ($DryRun) {
  $nodeArgs += "--dry-run"
}

Write-Host "Remote: $HostName"
Write-Host "ProjectDir: $ProjectDir"
Write-Host "DeployMode: $DeployMode"
Write-Host "OTA Channel: $OtaChannel"
Write-Host "Skip OTA: $SkipOta"
Write-Host "Command: node $($nodeArgs -join ' ')"

node @nodeArgs
exit $LASTEXITCODE
