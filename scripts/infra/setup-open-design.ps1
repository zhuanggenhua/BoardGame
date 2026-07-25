param(
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { "D:\codex-home" }),
    [string]$OpenDesignRoot = "",
    [string[]]$Agents = @("codex", "openclaw"),
    [switch]$InstallSource,
    [switch]$SkipMcpInstall,
    [switch]$NoPnpmUpgrade
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($OpenDesignRoot)) {
    $OpenDesignRoot = Join-Path $CodexHome "tools\open-design"
}

function Write-Step {
    param([string]$Message)
    Write-Host "[open-design] $Message"
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory = ""
    )

    if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) {
        & $FilePath @Arguments
    }
    else {
        Push-Location $WorkingDirectory
        try {
            & $FilePath @Arguments
        }
        finally {
            Pop-Location
        }
    }

    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-PnpmVersion {
    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpmCommand) {
        return $null
    }

    $version = (& pnpm -v 2>$null)
    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    return [string]$version
}

function Ensure-Pnpm {
    $version = Get-PnpmVersion
    if ($version -like "10.33.*") {
        Write-Step "pnpm $version is compatible."
        return
    }

    if ($NoPnpmUpgrade) {
        throw "Open Design expects pnpm 10.33.x, but current pnpm is '$version'. Re-run without -NoPnpmUpgrade or install pnpm@10.33.2 manually."
    }

    Write-Step "Installing pnpm@10.33.2 globally for Open Design source setup."
    Invoke-Checked "npm" @("install", "-g", "pnpm@10.33.2")
}

function Test-BetterSqliteBinding {
    $betterSqliteRoot = Join-Path $OpenDesignRoot "node_modules\.pnpm\better-sqlite3@12.10.0\node_modules\better-sqlite3"
    if (-not (Test-Path $betterSqliteRoot)) {
        return $false
    }

    $binding = Get-ChildItem $betterSqliteRoot -Recurse -Filter "better_sqlite3.node" -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $binding
}

function Find-OdCommand {
    $command = Get-Command od -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
        return @{
            Mode = "path"
            Path = $command.Source
        }
    }

    $packageJson = Join-Path $OpenDesignRoot "package.json"
    if (Test-Path $packageJson) {
        return @{
            Mode = "repo"
            Path = $OpenDesignRoot
        }
    }

    return $null
}

function Install-OpenDesignSource {
    $packageJson = Join-Path $OpenDesignRoot "package.json"
    if (-not (Test-Path $packageJson)) {
        if (Test-Path $OpenDesignRoot) {
            throw "OpenDesignRoot exists but does not look like Open Design source: $OpenDesignRoot"
        }

        $parent = Split-Path -Parent $OpenDesignRoot
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent | Out-Null
        }

        Write-Step "Cloning nexu-io/open-design into $OpenDesignRoot."
        Invoke-Checked "git" @("clone", "--depth", "1", "https://github.com/nexu-io/open-design.git", $OpenDesignRoot)
    }
    else {
        Write-Step "Using existing Open Design source at $OpenDesignRoot."
    }

    $nodeVersion = (& node -v 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not ([string]$nodeVersion).StartsWith("v24.")) {
        throw "Open Design expects Node 24.x. Current node is '$nodeVersion'."
    }

    Ensure-Pnpm
    Write-Step "Installing Open Design daemon/MCP dependencies."
    Invoke-Checked "pnpm" @("install", "--filter", "@open-design/daemon...", "--ignore-scripts") $OpenDesignRoot

    if (Test-BetterSqliteBinding) {
        Write-Step "better-sqlite3 binding already exists; skipping rebuild."
    }
    else {
        Write-Step "Rebuilding better-sqlite3 for the daemon runtime."
        Invoke-Checked "pnpm" @("--filter", "@open-design/daemon", "rebuild", "better-sqlite3") $OpenDesignRoot
    }

    Write-Step "Building Open Design daemon CLI."
    Invoke-Checked "pnpm" @("--filter", "@open-design/daemon...", "build") $OpenDesignRoot
}

function Invoke-Od {
    param([string[]]$Arguments)

    if ($script:OdCommand.Mode -eq "path") {
        Invoke-Checked $script:OdCommand.Path $Arguments
        return
    }

    Invoke-Checked "pnpm" (@("exec", "od") + $Arguments) $script:OdCommand.Path
}

function Set-CodexMcpConfig {
    $configPath = Join-Path $CodexHome "config.toml"
    $nodeCommand = (Get-Command node -ErrorAction Stop).Source
    $odBin = Join-Path $OpenDesignRoot "apps\daemon\bin\od.mjs"

    if (-not (Test-Path $odBin)) {
        throw "Open Design od entry not found: $odBin"
    }

    $block = @"
[mcp_servers.open-design]
command = '$nodeCommand'
args = [
  '$odBin',
  'mcp',
  '--daemon-url',
  'http://127.0.0.1:7456',
]
startup_timeout_sec = 120

[mcp_servers.open-design.env]
CODEX_HOME = '$CodexHome'
"@

    $content = ""
    if (Test-Path $configPath) {
        $content = [System.IO.File]::ReadAllText($configPath)
    }

    $pattern = "(?ms)^\[mcp_servers\.open-design\][\s\S]*?(?=^\[(?!mcp_servers\.open-design(?:\.env)?\])|\z)"
    if ([regex]::IsMatch($content, $pattern)) {
        $content = [regex]::Replace($content, $pattern, $block.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine)
    }
    else {
        if (-not $content.EndsWith([Environment]::NewLine) -and $content.Length -gt 0) {
            $content += [Environment]::NewLine
        }
        $content += [Environment]::NewLine + $block.TrimEnd() + [Environment]::NewLine
    }

    [System.IO.File]::WriteAllText($configPath, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Step "Codex MCP config written to $configPath."
}

if (-not (Test-Path $CodexHome)) {
    New-Item -ItemType Directory -Path $CodexHome | Out-Null
}

$env:CODEX_HOME = $CodexHome
Write-Step "CODEX_HOME=$CodexHome"

$script:OdCommand = Find-OdCommand
if ($InstallSource) {
    Install-OpenDesignSource
    $script:OdCommand = Find-OdCommand
}

if (-not $script:OdCommand) {
    throw "Open Design CLI 'od' was not found. Install the desktop app/source first, or run: npm run setup:open-design:install"
}

Write-Step "Using Open Design via $($script:OdCommand.Mode): $($script:OdCommand.Path)"

if (-not $SkipMcpInstall) {
    foreach ($agent in $Agents) {
        if ([string]::IsNullOrWhiteSpace($agent)) {
            continue
        }

        Write-Step "Installing MCP entry for $agent."
        if ($agent -eq "codex") {
            Set-CodexMcpConfig
            continue
        }

        try {
            Invoke-Od @("mcp", "install", $agent)
        }
        catch {
            if ($agent -eq "codex") {
                throw
            }

            Write-Warning "Open Design MCP install failed for optional agent '$agent': $($_.Exception.Message)"
        }
    }
}

Write-Step "Done. Restart Codex/OpenClaw before expecting new MCP tools in an existing session."
