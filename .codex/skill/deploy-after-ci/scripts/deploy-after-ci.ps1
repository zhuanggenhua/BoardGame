param(
  [switch]$CheckCi,
  [string]$Tag = "",
  [ValidateSet("ci-stream", "stream", "remote")]
  [string]$DeployMode = "ci-stream",
  [string]$OtaChannel = "stable",
  [string]$OtaExtra = "",
  [switch]$SkipOta,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($CheckCi) {
  & "$scriptDir\check-remote-ci.ps1"
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

$deployArgs = @{}
if ($Tag) {
  $deployArgs["Tag"] = $Tag
}
if ($DeployMode) {
  $deployArgs["DeployMode"] = $DeployMode
}
if ($OtaChannel) {
  $deployArgs["OtaChannel"] = $OtaChannel
}
if ($OtaExtra) {
  $deployArgs["OtaExtra"] = $OtaExtra
}
if ($SkipOta) {
  $deployArgs["SkipOta"] = $true
}
if ($DryRun) {
  $deployArgs["DryRun"] = $true
}

& "$scriptDir\deploy-prod.ps1" @deployArgs
exit $LASTEXITCODE
