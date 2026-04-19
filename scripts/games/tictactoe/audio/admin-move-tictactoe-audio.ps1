$ErrorActionPreference = 'Stop'

$projectRoot = 'd:\gongzuo\web\BordGame'
$source = Join-Path $projectRoot 'public\assets\tictactoe\audio'
$destRoot = Join-Path $projectRoot 'public\assets\common\audio\sfx\legacy\tictactoe'

if (-not (Test-Path $source)) {
  Write-Host "[AudioMove] source_not_found path=$source"
  exit 0
}

New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
Move-Item -Force -Path $source -Destination $destRoot
Write-Host "[AudioMove] moved source=$source dest=$destRoot"
