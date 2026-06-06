param()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..\\..")).Path
$guardScript = Join-Path $repoRoot "scripts\\infra\\git-command-guard.mjs"

function global:git {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$GitArgs
    )

    $currentRoot = & git.exe rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -eq 0 -and $currentRoot) {
        $resolvedCurrentRoot = (Resolve-Path $currentRoot.Trim()).Path
        if ($resolvedCurrentRoot -eq $repoRoot) {
            & node $guardScript @GitArgs
            return
        }
    }

    & git.exe @GitArgs
}

Write-Host "[boardgame-git-guard] 已为当前 PowerShell 会话启用项目 Git guard。"
Write-Host "[boardgame-git-guard] 本仓库内的 git 将先经过 scripts/infra/git-command-guard.mjs。"
Write-Host "[boardgame-git-guard] 如已获得用户当轮明确许可，可显式设置：`$env:BOARDGAME_GIT_GUARD_BYPASS='1'"
