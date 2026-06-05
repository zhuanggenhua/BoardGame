param(
  [string]$HostName = "admin@8.148.71.102",
  [string]$ProjectDir = "/home/admin/BoardGame",
  [string]$Tag = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$remoteCommand = "cd $ProjectDir && bash scripts/deploy/deploy-image.sh update"
if ($Tag) {
  $remoteCommand = "$remoteCommand $Tag"
}

Write-Host "Remote: $HostName"
Write-Host "Command: $remoteCommand"

if ($DryRun) {
  Write-Host "DryRun: deployment not executed."
  exit 0
}

ssh $HostName $remoteCommand
exit $LASTEXITCODE
