$ErrorActionPreference = 'Stop'

$projectRoot = 'd:\gongzuo\web\BordGame'
$source = Join-Path $projectRoot 'openspec\changes\refactor-audio-common-layer'
$archiveRoot = Join-Path $projectRoot 'openspec\changes\archive'
$target = Join-Path $archiveRoot '2026-02-05-refactor-audio-common-layer'

if (-not (Test-Path $source)) {
  Write-Host "[Archive] source_not_found path=$source"
  exit 0
}

New-Item -ItemType Directory -Force -Path $archiveRoot | Out-Null
Move-Item -Force -Path $source -Destination $target
Write-Host "[Archive] moved source=$source target=$target"
