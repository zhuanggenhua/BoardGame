param(
  [string]$HostName = "admin@8.148.71.102",
  [string]$ProjectDir = "/home/admin/BoardGame",
  [string]$Tag = "",
  [ValidateSet("ci-stream", "stream", "remote")]
  [string]$DeployMode = "ci-stream",
  [string]$OtaChannel = "stable",
  [string]$OtaExtra = "",
  [switch]$DeployPreview,
  [string]$PreviewHostName = "zhanggenhua@direct-home.easyboardgame.top",
  [string]$PreviewProjectDir = "/home/zhanggenhua/BoardGame",
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

if ($DeployPreview) {
  $nodeArgs += @(
    "--deploy-preview",
    "--preview-host", $PreviewHostName,
    "--preview-remote-dir", $PreviewProjectDir
  )
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
Write-Host "Deploy Preview: $DeployPreview"
Write-Host "Preview Remote: $PreviewHostName"
Write-Host "Preview ProjectDir: $PreviewProjectDir"
Write-Host "Skip OTA: $SkipOta"
Write-Host "Command: node $($nodeArgs -join ' ')"

node @nodeArgs
exit $LASTEXITCODE
