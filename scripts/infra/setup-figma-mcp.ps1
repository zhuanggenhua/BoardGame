param(
    [string]$ConfigPath,
    [string]$CodexHome,
    [switch]$SkipLogin,
    [switch]$OpenWindow,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-CodexHome {
    param([string]$ExplicitCodexHome)

    if ($ExplicitCodexHome) {
        return $ExplicitCodexHome
    }
    if ($env:CODEX_HOME) {
        return $env:CODEX_HOME
    }
    if (Test-Path "D:\codex-home") {
        return "D:\codex-home"
    }
    return (Join-Path $env:USERPROFILE ".codex")
}

function Resolve-CodexCli {
    $command = Get-Command codex -ErrorAction SilentlyContinue
    if ($command) {
        return "codex"
    }

    if ($env:CODEX_CLI_PATH -and (Test-Path $env:CODEX_CLI_PATH)) {
        return $env:CODEX_CLI_PATH
    }

    $openAiBinRoot = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin"
    if (Test-Path $openAiBinRoot) {
        $candidate = Get-ChildItem -Path $openAiBinRoot -Recurse -Filter codex.exe -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($candidate) {
            return $candidate.FullName
        }
    }

    throw "未找到 codex CLI。请先确认 Codex 已安装，且 'codex' 命令可用。"
}

function Set-OrAppendSectionBlock {
    param(
        [string]$Content,
        [string]$SectionName,
        [string]$Block
    )

    $escapedSection = [Regex]::Escape($SectionName)
    $pattern = '(?ms)^\[' + $escapedSection + '\]\s*\r?\n.*?(?=^\[[^\]]+\]\s*$|\z)'
    if ([Regex]::IsMatch($Content, $pattern)) {
        return [Regex]::Replace($Content, $pattern, $Block)
    }

    $trimmed = $Content.TrimEnd()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        return $Block.TrimEnd() + [Environment]::NewLine
    }

    return $trimmed + [Environment]::NewLine + [Environment]::NewLine + $Block.TrimEnd() + [Environment]::NewLine
}

function Set-OrAppendKeyInSection {
    param(
        [string]$Content,
        [string]$SectionName,
        [string]$Key,
        [string]$ValueExpression
    )

    $escapedSection = [Regex]::Escape($SectionName)
    $sectionPattern = '(?ms)^\[' + $escapedSection + '\]\s*\r?\n(?<body>.*?)(?=^\[[^\]]+\]\s*$|\z)'

    if ([Regex]::IsMatch($Content, $sectionPattern)) {
        $match = [Regex]::Match($Content, $sectionPattern)
        $body = $match.Groups["body"].Value
        $escapedKey = [Regex]::Escape($Key)
        $keyPattern = '(?m)^' + $escapedKey + '\s*=.*$'
        if ([Regex]::IsMatch($body, $keyPattern)) {
            $newBody = [Regex]::Replace($body, $keyPattern, "$Key = $ValueExpression", 1)
        } else {
            $bodyTrimmed = $body.TrimEnd()
            if ([string]::IsNullOrWhiteSpace($bodyTrimmed)) {
                $newBody = "$Key = $ValueExpression" + [Environment]::NewLine
            } else {
                $newBody = $bodyTrimmed + [Environment]::NewLine + "$Key = $ValueExpression" + [Environment]::NewLine
            }
        }

        $replacement = "[$SectionName]" + [Environment]::NewLine + $newBody
        return [Regex]::Replace($Content, $sectionPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $replacement }, 1)
    }

    $sectionBlock = "[$SectionName]" + [Environment]::NewLine + "$Key = $ValueExpression" + [Environment]::NewLine
    return Set-OrAppendSectionBlock -Content $Content -SectionName $SectionName -Block $sectionBlock
}

function Set-OrAppendRootKey {
    param(
        [string]$Content,
        [string]$Key,
        [string]$ValueExpression
    )

    $escapedKey = [Regex]::Escape($Key)
    $keyPattern = '(?m)^' + $escapedKey + '\s*=.*$'
    if ([Regex]::IsMatch($Content, $keyPattern)) {
        return [Regex]::Replace($Content, $keyPattern, "$Key = $ValueExpression", 1)
    }

    $lines = @()
    if (-not [string]::IsNullOrEmpty($Content)) {
        $lines = [System.Collections.Generic.List[string]]::new()
        foreach ($line in ($Content -split '\r?\n')) {
            $lines.Add($line)
        }
    } else {
        $lines = [System.Collections.Generic.List[string]]::new()
    }

    $insertIndex = $lines.Count
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\[') {
            $insertIndex = $i
            break
        }
    }

    $lines.Insert($insertIndex, "$Key = $ValueExpression")
    return (($lines -join [Environment]::NewLine).TrimEnd() + [Environment]::NewLine)
}

function New-BackupPath {
    param([string]$Path)
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    return "$Path.bak.$timestamp"
}

function Invoke-OpenWindow {
    param(
        [string]$ScriptPath,
        [string]$ResolvedCodexHome,
        [string]$ResolvedConfigPath,
        [switch]$SkipLoginFlag,
        [switch]$DryRunFlag
    )

    $argumentList = @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", $ScriptPath,
        "-CodexHome", $ResolvedCodexHome,
        "-ConfigPath", $ResolvedConfigPath
    )

    if ($SkipLoginFlag) {
        $argumentList += "-SkipLogin"
    }
    if ($DryRunFlag) {
        $argumentList += "-DryRun"
    }

    Start-Process powershell.exe -ArgumentList $argumentList
}

$resolvedCodexHome = Resolve-CodexHome -ExplicitCodexHome $CodexHome
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $resolvedCodexHome "config.toml"
}

if ($OpenWindow) {
    Invoke-OpenWindow -ScriptPath $PSCommandPath -ResolvedCodexHome $resolvedCodexHome -ResolvedConfigPath $ConfigPath -SkipLoginFlag:$SkipLogin -DryRunFlag:$DryRun
    [ordered]@{
        codexHome = $resolvedCodexHome
        configPath = $ConfigPath
        launchedWindow = $true
        nextSteps = @(
            "已打开独立 PowerShell 窗口。",
            "窗口里会继续执行 Figma MCP 配置与网页登录授权。"
        )
    } | ConvertTo-Json -Depth 5
    return
}

$codexCli = Resolve-CodexCli
$configDir = Split-Path -Parent $ConfigPath
if (-not (Test-Path $configDir) -and -not $DryRun) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$existingContent = ""
if (Test-Path $ConfigPath) {
    $existingContent = Get-Content -Raw $ConfigPath
}

$figmaBlock = "[mcp_servers.figma]" + [Environment]::NewLine + 'url = "https://mcp.figma.com/mcp"' + [Environment]::NewLine

$updatedContent = Set-OrAppendRootKey -Content $existingContent -Key "mcp_oauth_credentials_store" -ValueExpression '"file"'
$updatedContent = Set-OrAppendSectionBlock -Content $updatedContent -SectionName "mcp_servers.figma" -Block $figmaBlock
$updatedContent = Set-OrAppendKeyInSection -Content $updatedContent -SectionName "features" -Key "rmcp_client" -ValueExpression "true"

$backupPath = $null
if ($existingContent -ne $updatedContent -and -not $DryRun -and (Test-Path $ConfigPath)) {
    $backupPath = New-BackupPath -Path $ConfigPath
    Copy-Item -LiteralPath $ConfigPath -Destination $backupPath -Force
}

if (-not $DryRun) {
    Set-Content -LiteralPath $ConfigPath -Value $updatedContent -Encoding UTF8
}

$loginAttempted = $false
$loginSucceeded = $false
if (-not $DryRun -and -not $SkipLogin) {
    $loginAttempted = $true
    Write-Host "已写入 Figma MCP 配置，准备启动 Codex OAuth 登录。"
    Write-Host "如果浏览器弹出授权页，直接按提示登录并授权即可。"
    & $codexCli mcp login figma
    if ($LASTEXITCODE -eq 0) {
        $loginSucceeded = $true
    } else {
        throw "Codex OAuth 登录失败，退出码：$LASTEXITCODE"
    }
}

[ordered]@{
    codexHome = $resolvedCodexHome
    configPath = $ConfigPath
    configChanged = ($existingContent -ne $updatedContent)
    backupPath = $backupPath
    loginAttempted = $loginAttempted
    loginSucceeded = $loginSucceeded
    dryRun = [bool]$DryRun
    nextSteps = @(
        "重启 Codex / OpenClaw 会话，让新的 MCP 配置和 OAuth 登录态生效。",
        "重启后重新发起 Figma 任务，确认工具列表里已经出现 use_figma / get_metadata / get_screenshot。"
    )
} | ConvertTo-Json -Depth 5
