param(
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { "D:\codex-home" }),
    [string]$OpenDesignRoot = "",
    [int]$Port = 7456
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($OpenDesignRoot)) {
    $OpenDesignRoot = Join-Path $CodexHome "tools\open-design"
}

$odBin = Join-Path $OpenDesignRoot "apps\daemon\bin\od.mjs"
if (-not (Test-Path $odBin)) {
    throw "Open Design od entry not found: $odBin. Run npm run setup:open-design:install first."
}

function Test-OpenDesignDaemon {
    try {
        $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/api/health" -TimeoutSec 3
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    }
    catch {
        return $false
    }
}

if (Test-OpenDesignDaemon) {
    Write-Host "[open-design] daemon already reachable at http://127.0.0.1:$Port"
    exit 0
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$logDir = Join-Path $projectRoot "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$outLog = Join-Path $logDir "open-design-daemon.out.log"
$errLog = Join-Path $logDir "open-design-daemon.err.log"
$nodeCommand = (Get-Command node -ErrorAction Stop).Source

$command = @"
`$env:CODEX_HOME = '$CodexHome'
Set-Location '$OpenDesignRoot'
& '$nodeCommand' '$odBin' --host 127.0.0.1 --port $Port --no-open
"@

$process = Start-Process -FilePath powershell.exe -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $command) -RedirectStandardOutput $outLog -RedirectStandardError $errLog -WindowStyle Hidden -PassThru
Write-Host "[open-design] daemon process started: $($process.Id)"

Start-Sleep -Seconds 8
if (Test-OpenDesignDaemon) {
    Write-Host "[open-design] daemon reachable at http://127.0.0.1:$Port"
    exit 0
}

Write-Host "[open-design] daemon did not become reachable yet. stdout tail:"
if (Test-Path $outLog) {
    Get-Content $outLog -Tail 40
}
Write-Host "[open-design] stderr tail:"
if (Test-Path $errLog) {
    Get-Content $errLog -Tail 40
}
exit 1
