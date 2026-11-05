param(
  [string]$HostName = "admin@8.148.71.102",
  [string]$ProjectDir = "/home/admin/BoardGame",
  [string]$Tag = "",
  [ValidateSet("ci-stream", "stream", "remote")]
  [string]$DeployMode = "ci-stream",
  [string]$OtaChannel = "stable",
  [string]$OtaExtra = "",
  [string]$ChangelogFile = "",
  [string]$ChangelogApiBaseUrl = "",
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

if ($ChangelogFile) {
  $nodeArgs += @("--changelog-file", $ChangelogFile)
}

if ($ChangelogApiBaseUrl) {
  $nodeArgs += @("--changelog-api-base-url", $ChangelogApiBaseUrl)
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
Write-Host "Changelog File: $(if ($ChangelogFile) { $ChangelogFile } else { '无（本次 OTA 更新说明留空）' })"
Write-Host "Changelog API: $(if ($ChangelogApiBaseUrl) { '命令行已设置' } elseif ($env:BG_CHANGELOG_API_BASE_URL) { 'BG_CHANGELOG_API_BASE_URL 已设置' } elseif ($env:VITE_BACKEND_URL) { 'VITE_BACKEND_URL 已设置' } else { '未配置（未提供日志文件时无需配置）' })"
Write-Host "Deploy Preview: $DeployPreview"
Write-Host "Preview Remote: $PreviewHostName"
Write-Host "Preview ProjectDir: $PreviewProjectDir"
Write-Host "Skip OTA: $SkipOta"
Write-Host "Command: node $($nodeArgs -join ' ')"

node @nodeArgs
exit $LASTEXITCODE
