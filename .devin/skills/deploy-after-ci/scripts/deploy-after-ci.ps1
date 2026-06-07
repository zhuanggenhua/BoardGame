param(
  [switch]$CheckCi,
  [string]$Tag = "",
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
if ($DryRun) {
  $deployArgs["DryRun"] = $true
}

& "$scriptDir\deploy-prod.ps1" @deployArgs
exit $LASTEXITCODE
