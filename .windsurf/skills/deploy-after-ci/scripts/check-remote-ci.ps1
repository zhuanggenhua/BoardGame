param(
  [string]$Repo = "zhuanggenhua/BoardGame",
  [string]$Branch = "main",
  [string]$WorkflowName = "Build & Push Docker Images"
)

$ErrorActionPreference = "Stop"

function Fail($Message, $Code) {
  Write-Host $Message
  exit $Code
}

$remoteSha = ""

$apiSha = gh api "repos/$Repo/git/ref/heads/$Branch" --jq ".object.sha" 2>$null
if ($LASTEXITCODE -eq 0 -and $apiSha) {
  $remoteSha = ($apiSha | Select-Object -First 1).Trim()
}

if (-not $remoteSha) {
  $remoteLine = git ls-remote origin "refs/heads/$Branch" 2>$null
  if ($LASTEXITCODE -eq 0 -and $remoteLine) {
    $remoteSha = (($remoteLine | Select-Object -First 1) -split "\s+")[0]
  }
}

if (-not $remoteSha) {
  $localRef = git rev-parse "origin/$Branch" 2>$null
  if ($LASTEXITCODE -eq 0 -and $localRef) {
    $remoteSha = ($localRef | Select-Object -First 1).Trim()
    Write-Host "Warning: using local origin/$Branch ref because remote SHA lookup failed."
  }
}

if (-not $remoteSha) {
  Fail "Failed to read origin/$Branch SHA." 1
}

Write-Host "origin/$Branch = $remoteSha"

$json = gh run list --repo $Repo --branch $Branch --limit 30 --json databaseId,status,conclusion,workflowName,headSha,createdAt,updatedAt,url,displayTitle
$runs = $json | ConvertFrom-Json
$run = $runs | Where-Object {
  $_.workflowName -eq $WorkflowName -and $_.headSha -eq $remoteSha
} | Select-Object -First 1

if (-not $run) {
  Fail "No matching $WorkflowName run found; deployment skipped." 2
}

Write-Host "CI: $($run.workflowName) #$($run.databaseId)"
Write-Host "Status: $($run.status) / $($run.conclusion)"
Write-Host "URL: $($run.url)"

if ($run.status -ne "completed") {
  Fail "CI is not completed; deployment skipped." 2
}

if ($run.conclusion -ne "success") {
  Fail "CI did not succeed; deployment skipped." 1
}

Write-Host "Docker image CI succeeded; deployment is allowed."
exit 0
