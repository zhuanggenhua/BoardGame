param(
    [string]$ConfigPath,
    [string]$CodexHome,
    [switch]$Login,
    [switch]$SkipLogin,
    [switch]$OpenWindow,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-CodexHome {
    param([string]$ExplicitCodexHome)

    if ($ExplicitCodexHome) { return $ExplicitCodexHome }
    if ($env:CODEX_HOME) { return $env:CODEX_HOME }
    if (Test-Path "D:\codex-home") { return "D:\codex-home" }
    return (Join-Path $env:USERPROFILE ".codex")
}

function Resolve-CodexCli {
    $command = Get-Command codex -ErrorAction SilentlyContinue
    if ($command) { return "codex" }

    if ($env:CODEX_CLI_PATH -and (Test-Path $env:CODEX_CLI_PATH)) {
        return $env:CODEX_CLI_PATH
    }

    $openAiBinRoot = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin"
    if (Test-Path $openAiBinRoot) {
        $candidate = Get-ChildItem -Path $openAiBinRoot -Recurse -Filter codex.exe -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($candidate) { return $candidate.FullName }
    }

    throw "codex CLI was not found."
}

function Get-SectionStartIndex {
    param(
        [string[]]$Lines,
        [string]$SectionName
    )

    $target = "[$SectionName]"
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -eq $target) {
            return $i
        }
    }

    return -1
}

function Get-FirstSectionIndex {
    param([string[]]$Lines)

    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^\[[^\]]+\]$') {
            return $i
        }
    }

    return $Lines.Count
}

function Get-RootKeyIndex {
    param(
        [string[]]$Lines,
        [string]$Key
    )

    $target = "^\s*{0}\s*=" -f [Regex]::Escape($Key)
    $firstSectionIndex = Get-FirstSectionIndex -Lines $Lines

    for ($i = 0; $i -lt $firstSectionIndex; $i++) {
        if ($Lines[$i] -match $target) {
            return $i
        }
    }

    return -1
}

function Get-KeyIndexInSection {
    param(
        [string[]]$Lines,
        [int]$SectionStartIndex,
        [string]$Key
    )

    if ($SectionStartIndex -lt 0) { return -1 }

    $keyPattern = "^\s*{0}\s*=" -f [Regex]::Escape($Key)
    for ($i = $SectionStartIndex + 1; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^\[[^\]]+\]$') {
            break
        }
        if ($Lines[$i] -match $keyPattern) {
            return $i
        }
    }

    return -1
}

function Set-OrAppendRootKey {
    param(
        [string[]]$Lines,
        [string]$Key,
        [string]$ValueExpression
    )

    $updatedLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $Lines) {
        [void]$updatedLines.Add($line)
    }

    $keyIndex = Get-RootKeyIndex -Lines $Lines -Key $Key
    $newLine = ('{0} = {1}' -f $Key, $ValueExpression)
    if ($keyIndex -ge 0) {
        $updatedLines[$keyIndex] = $newLine
        return ,$updatedLines.ToArray()
    }

    $insertIndex = Get-FirstSectionIndex -Lines $Lines
    $updatedLines.Insert($insertIndex, $newLine)
    return ,$updatedLines.ToArray()
}

function Set-OrAppendKeyInSection {
    param(
        [string[]]$Lines,
        [string]$SectionName,
        [string]$Key,
        [string]$ValueExpression
    )

    $updatedLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $Lines) {
        [void]$updatedLines.Add($line)
    }

    $sectionStart = Get-SectionStartIndex -Lines $Lines -SectionName $SectionName
    if ($sectionStart -lt 0) {
        [void]$updatedLines.Add("")
        [void]$updatedLines.Add("[$SectionName]")
        [void]$updatedLines.Add(('{0} = {1}' -f $Key, $ValueExpression))
        return ,$updatedLines.ToArray()
    }

    $keyIndex = Get-KeyIndexInSection -Lines $Lines -SectionStartIndex $sectionStart -Key $Key
    $newLine = ('{0} = {1}' -f $Key, $ValueExpression)
    if ($keyIndex -ge 0) {
        $updatedLines[$keyIndex] = $newLine
        return ,$updatedLines.ToArray()
    }

    $insertIndex = $sectionStart + 1
    while ($insertIndex -lt $updatedLines.Count -and [string]::IsNullOrWhiteSpace($updatedLines[$insertIndex])) {
        $insertIndex++
    }

    while ($insertIndex -lt $updatedLines.Count -and $updatedLines[$insertIndex] -notmatch '^\[[^\]]+\]$') {
        $insertIndex++
    }

    $updatedLines.Insert($insertIndex, $newLine)
    return ,$updatedLines.ToArray()
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
        [switch]$LoginFlag,
        [switch]$DryRunFlag
    )

    $argumentList = @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File", $ScriptPath,
        "-CodexHome", $ResolvedCodexHome,
        "-ConfigPath", $ResolvedConfigPath
    )

    if ($LoginFlag) { $argumentList += "-Login" }
    if ($DryRunFlag) { $argumentList += "-DryRun" }

    Start-Process powershell.exe -ArgumentList $argumentList
}

if ($Login -and $SkipLogin) {
    throw "-Login and -SkipLogin cannot be used together."
}

$resolvedCodexHome = Resolve-CodexHome -ExplicitCodexHome $CodexHome
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $resolvedCodexHome "config.toml"
}

if ($OpenWindow) {
    Invoke-OpenWindow -ScriptPath $PSCommandPath -ResolvedCodexHome $resolvedCodexHome -ResolvedConfigPath $ConfigPath -LoginFlag:$Login -DryRunFlag:$DryRun
    [ordered]@{
        codexHome = $resolvedCodexHome
        configPath = $ConfigPath
        launchedWindow = $true
        loginRequested = [bool]$Login
        nextSteps = @(
            "Opened a separate PowerShell window.",
            "Use -Login only when re-authorization is required."
        )
    } | ConvertTo-Json -Depth 5
    return
}

$existingLines = @()
if (Test-Path $ConfigPath) {
    $existingLines = Get-Content -LiteralPath $ConfigPath
}

$updatedLines = $existingLines
$updatedLines = Set-OrAppendRootKey -Lines $updatedLines -Key "mcp_oauth_credentials_store" -ValueExpression '"file"'
$updatedLines = Set-OrAppendKeyInSection -Lines $updatedLines -SectionName "features" -Key "rmcp_client" -ValueExpression "true"
$updatedLines = Set-OrAppendKeyInSection -Lines $updatedLines -SectionName "mcp_servers.figma" -Key "url" -ValueExpression '"https://mcp.figma.com/mcp"'

$originalText = [string]::Join([Environment]::NewLine, $existingLines)
$updatedText = [string]::Join([Environment]::NewLine, $updatedLines)
$configChanged = ($originalText -ne $updatedText)
$backupPath = $null
if (-not $DryRun -and $configChanged) {
    $configDir = Split-Path -Parent $ConfigPath
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }

    if (Test-Path $ConfigPath) {
        $backupPath = New-BackupPath -Path $ConfigPath
        Copy-Item -LiteralPath $ConfigPath -Destination $backupPath -Force
    }

    Set-Content -LiteralPath $ConfigPath -Value $updatedLines -Encoding utf8
}

$loginAttempted = $false
$loginSucceeded = $false
if (-not $DryRun -and $Login) {
    $loginAttempted = $true
    $codexCli = Resolve-CodexCli
    Write-Host "Figma MCP config is written. Starting Codex OAuth login."
    Write-Host "After browser authorization succeeds, Codex stores file-backed credentials for future sessions."
    & $codexCli mcp login figma
    if ($LASTEXITCODE -eq 0) {
        $loginSucceeded = $true
    } else {
        throw "Codex OAuth login failed with exit code: $LASTEXITCODE"
    }
}

$credentialsPath = Join-Path $resolvedCodexHome ".credentials.json"
[ordered]@{
    codexHome = $resolvedCodexHome
    configPath = $ConfigPath
    configChanged = $configChanged
    backupPath = $backupPath
    credentialStoreFilePresent = (Test-Path $credentialsPath)
    loginAttempted = $loginAttempted
    loginSucceeded = $loginSucceeded
    dryRun = [bool]$DryRun
    nextSteps = @(
        "Default mode does not repeat Figma OAuth login; existing file-backed credentials are reused by new Codex / OpenClaw sessions.",
        "If authorization was never completed or tools are still unavailable, rerun this script with -Login once.",
        "After config or auth changes, restart Codex / OpenClaw and check for use_figma / get_metadata / get_screenshot."
    )
} | ConvertTo-Json -Depth 5
