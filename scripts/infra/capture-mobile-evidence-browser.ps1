param(
    [Parameter(Mandatory = $true)]
    [int]$Port,

    [Parameter(Mandatory = $true)]
    [string]$Url,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [string]$Root = 'D:\gongzuo\webgame\BoardGame',
    [string]$EdgePath = '',
    [string]$HeadlessShellPath = '',
    [string]$UserDataDir = '',
    [int]$ReadyTimeoutSec = 30,
    [int]$CaptureTimeoutSec = 90,
    [int]$WindowWidth = 936,
    [int]$WindowHeight = 432,
    [int]$RemoteDebuggingPort = 9223,
    [switch]$ForceCoarsePointer
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web

function Wait-UrlReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetUrl,

        [int]$TimeoutSec = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    do {
        try {
            $response = Invoke-WebRequest -Uri $TargetUrl -Method 'GET' -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        } catch {
        }

        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    throw "URL was not ready before timeout: $TargetUrl"
}

function Add-QueryParam {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetUrl,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $builder = [System.UriBuilder]$TargetUrl
    $query = [System.Web.HttpUtility]::ParseQueryString($builder.Query)
    $query.Set($Name, $Value)
    $builder.Query = $query.ToString()
    return $builder.Uri.AbsoluteUri
}

function Resolve-BrowserPath {
    param(
        [string]$PreferredPath
    )

    if (-not [string]::IsNullOrWhiteSpace($PreferredPath)) {
        if (Test-Path $PreferredPath) {
            return $PreferredPath
        }

        throw "Browser executable not found: $PreferredPath"
    }

    $candidates = @(
        'C:\Program Files\Google\Chrome\Application\chrome.exe',
        'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    throw 'No supported browser found. Provide -EdgePath to use a specific Chrome or Edge executable.'
}

function Resolve-HeadlessShellPath {
    param(
        [string]$PreferredPath
    )

    if (-not [string]::IsNullOrWhiteSpace($PreferredPath)) {
        if (Test-Path $PreferredPath) {
            return $PreferredPath
        }

        throw "Headless shell executable not found: $PreferredPath"
    }

    $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
    if ([string]::IsNullOrWhiteSpace($localAppData)) {
        return ''
    }

    $playwrightRoot = Join-Path $localAppData 'ms-playwright'
    if (-not (Test-Path $playwrightRoot)) {
        return ''
    }

    $candidates = Get-ChildItem -Path $playwrightRoot -Directory -Filter 'chromium_headless_shell-*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending

    foreach ($candidateDir in $candidates) {
        $candidate = Join-Path $candidateDir.FullName 'chrome-headless-shell-win64\chrome-headless-shell.exe'
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return ''
}

function Get-PageDebugTitle {
    param(
        [int]$Port,
        [string]$ExpectedUrlPrefix
    )

    try {
        $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list" -Method 'GET' -TimeoutSec 2
        $pageTarget = $targets | Where-Object {
            $_.type -eq 'page' -and $_.url -like "$ExpectedUrlPrefix*"
        } | Select-Object -First 1

        if ($pageTarget) {
            return @{
                Title = [string]$pageTarget.title
                Url = [string]$pageTarget.url
            }
        }
    } catch {
    }

    return $null
}

function Get-CaptureStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetUrl
    )

    try {
        return Invoke-RestMethod -Uri $TargetUrl -Method 'GET' -TimeoutSec 2
    } catch {
        return $null
    }
}

function Wait-RemoteDebuggingReady {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port,

        [int]$TimeoutSec = 15
    )

    Wait-UrlReady -TargetUrl "http://127.0.0.1:$Port/json/version" -TimeoutSec $TimeoutSec
}

function Open-CaptureTarget {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port,

        [Parameter(Mandatory = $true)]
        [string]$TargetUrl
    )

    $encodedUrl = [System.Uri]::EscapeDataString($TargetUrl)
    return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/new?$encodedUrl" -Method 'PUT' -TimeoutSec 5
}

$viteLogStamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH-mm-ss-fffZ')
$viteLogPath = Join-Path $Root "logs\mobile-evidence-browser-vite-$Port-$viteLogStamp.log"
$readyUrl = "http://127.0.0.1:$Port/__ready"
$profileDir = if ([string]::IsNullOrWhiteSpace($UserDataDir)) {
    Join-Path $Root "temp\mobile-evidence-browser-profile-$Port"
} else {
    $UserDataDir
}
$captureUrl = Add-QueryParam -TargetUrl $Url -Name 'bgCaptureOutputPath' -Value $OutputPath
$captureUriBuilder = [System.UriBuilder]$captureUrl
$captureQuery = [System.Web.HttpUtility]::ParseQueryString($captureUriBuilder.Query)
$captureScenario = $captureQuery.Get('bgCapture')
$captureStatusUrl = if ([string]::IsNullOrWhiteSpace($captureScenario)) {
    ''
} else {
    "http://127.0.0.1:$Port/__capture/status?scenario=$([System.Uri]::EscapeDataString($captureScenario))"
}

if ($ForceCoarsePointer) {
    $captureUrl = Add-QueryParam -TargetUrl $captureUrl -Name 'bgForceCoarsePointer' -Value '1'
}

$browserPath = Resolve-BrowserPath -PreferredPath $EdgePath
$headlessShellPath = Resolve-HeadlessShellPath -PreferredPath $HeadlessShellPath

New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($OutputPath)) | Out-Null
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}
$viteJob = Start-Job -ScriptBlock {
    param($rootPath, $portNumber, $logFile)
    Set-Location $rootPath
    $env:BG_ENABLE_CAPTURE_SAVE = '1'
    $env:BG_CAPTURE_TRACE_REQUESTS = '1'
    node scripts/infra/vite-with-logging.js --host 127.0.0.1 --port $portNumber --configLoader native *> $logFile
} -ArgumentList $Root, $Port, $viteLogPath

$commonBrowserArgs = @(
    "--user-data-dir=$profileDir",
    "--window-size=$WindowWidth,$WindowHeight",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$RemoteDebuggingPort",
    '--window-position=0,0',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check'
)

$browserLaunchPlans = @()

if (-not [string]::IsNullOrWhiteSpace($headlessShellPath)) {
    $browserLaunchPlans += @{
        Name = 'headless-shell-single-process'
        BrowserPath = $headlessShellPath
        UsesCdp = $false
        Arguments = @(
            "--user-data-dir=$profileDir",
            "--window-size=$WindowWidth,$WindowHeight",
            "--remote-debugging-address=127.0.0.1",
            "--remote-debugging-port=$RemoteDebuggingPort",
            '--disable-gpu',
            '--disable-crash-reporter',
            '--no-sandbox',
            '--single-process',
            '--no-zygote',
            $captureUrl
        )
    }
}

$browserLaunchPlans += @(
    @{
        Name = 'cdp-window'
        BrowserPath = $browserPath
        UsesCdp = $true
        Arguments = $commonBrowserArgs + @('--new-window', 'about:blank')
    },
    @{
        Name = 'direct-window'
        BrowserPath = $browserPath
        UsesCdp = $false
        Arguments = $commonBrowserArgs + @('--new-window', $captureUrl)
    }
)

function Start-CaptureBrowserProcess {
    param(
        [Parameter(Mandatory = $true)]
        [int]$LaunchIndex
    )

    $plan = $browserLaunchPlans[$LaunchIndex]
    Write-Output "[capture-mobile-evidence] Launch browser via $($plan.Name): $($plan.BrowserPath)"
    return Start-Process -FilePath $plan.BrowserPath -ArgumentList $plan.Arguments -PassThru
}

function Initialize-CapturePlan {
    param(
        [Parameter(Mandatory = $true)]
        [int]$LaunchIndex
    )

    $plan = $browserLaunchPlans[$LaunchIndex]
    if (-not $plan.UsesCdp) {
        return $null
    }

    Wait-RemoteDebuggingReady -Port $RemoteDebuggingPort -TimeoutSec 15
    $openedTarget = Open-CaptureTarget -Port $RemoteDebuggingPort -TargetUrl $captureUrl
    if ($openedTarget) {
        Write-Output "[capture-mobile-evidence] Opened capture target: $($openedTarget.url)"
    }
    return $openedTarget
}

$edgeProcess = $null
$lastWindowTitle = ''
$lastPageTitle = ''
$lastStatusPhase = ''
$lastStatusMessage = ''
$browserLaunchIndex = 0
$reportedLauncherExit = $false
try {
    Wait-UrlReady -TargetUrl $readyUrl -TimeoutSec $ReadyTimeoutSec

    $edgeProcess = Start-CaptureBrowserProcess -LaunchIndex $browserLaunchIndex
    try {
        $null = Initialize-CapturePlan -LaunchIndex $browserLaunchIndex
    } catch {
        if ($browserLaunchIndex -lt ($browserLaunchPlans.Count - 1)) {
            Write-Output "[capture-mobile-evidence] Launch plan $($browserLaunchPlans[$browserLaunchIndex].Name) failed during init: $($_.Exception.Message)"
            if ($edgeProcess -and (Get-Process -Id $edgeProcess.Id -ErrorAction SilentlyContinue)) {
                Stop-Process -Id $edgeProcess.Id -Force -ErrorAction SilentlyContinue
            }
            $browserLaunchIndex += 1
            $edgeProcess = Start-CaptureBrowserProcess -LaunchIndex $browserLaunchIndex
            $null = Initialize-CapturePlan -LaunchIndex $browserLaunchIndex
        } else {
            throw
        }
    }

    $deadline = (Get-Date).AddSeconds($CaptureTimeoutSec)
    $planStartedAt = Get-Date
    do {
        if (Test-Path $OutputPath) {
            break
        }

        if (
            [string]::IsNullOrWhiteSpace($lastStatusPhase) `
            -and $browserLaunchIndex -lt ($browserLaunchPlans.Count - 1) `
            -and ((Get-Date) - $planStartedAt).TotalSeconds -ge 8
        ) {
            Write-Output "[capture-mobile-evidence] No capture status observed after 8s with $($browserLaunchPlans[$browserLaunchIndex].Name); retrying with $($browserLaunchPlans[$browserLaunchIndex + 1].Name)"
            if ($edgeProcess -and (Get-Process -Id $edgeProcess.Id -ErrorAction SilentlyContinue)) {
                Stop-Process -Id $edgeProcess.Id -Force -ErrorAction SilentlyContinue
            }
            $browserLaunchIndex += 1
            $edgeProcess = Start-CaptureBrowserProcess -LaunchIndex $browserLaunchIndex
            $reportedLauncherExit = $false
            $lastWindowTitle = ''
            $lastPageTitle = ''
            $planStartedAt = Get-Date
            $null = Initialize-CapturePlan -LaunchIndex $browserLaunchIndex
            Start-Sleep -Milliseconds 500
            continue
        }

        $currentEdgeProcess = if ($edgeProcess) {
            Get-Process -Id $edgeProcess.Id -ErrorAction SilentlyContinue
        } else {
            $null
        }

        if ($currentEdgeProcess) {
            $currentTitle = [string]$currentEdgeProcess.MainWindowTitle
            if ($currentTitle -ne $lastWindowTitle) {
                $lastWindowTitle = $currentTitle
                if (![string]::IsNullOrWhiteSpace($currentTitle)) {
                    Write-Output "[capture-mobile-evidence] Browser title: $currentTitle"
                }
            }
        }

        $pageDebugState = Get-PageDebugTitle -Port $RemoteDebuggingPort -ExpectedUrlPrefix "http://127.0.0.1:$Port/"
        if ($pageDebugState) {
            $debugTitle = $pageDebugState.Title
            if ($debugTitle -and $debugTitle -ne $lastPageTitle) {
                $lastPageTitle = $debugTitle
                Write-Output "[capture-mobile-evidence] Page title: $debugTitle"
                Write-Output "[capture-mobile-evidence] Page url: $($pageDebugState.Url)"
            }
        }

        if ($captureStatusUrl) {
            $statusResponse = Get-CaptureStatus -TargetUrl $captureStatusUrl
            $status = $statusResponse.status
            if ($status) {
                $statusPhase = [string]$status.phase
                $statusMessage = [string]$status.message
                if ($statusPhase -ne $lastStatusPhase -or $statusMessage -ne $lastStatusMessage) {
                    $lastStatusPhase = $statusPhase
                    $lastStatusMessage = $statusMessage
                    Write-Output "[capture-mobile-evidence] Capture status: $statusPhase"
                    if (![string]::IsNullOrWhiteSpace($statusMessage)) {
                        Write-Output "[capture-mobile-evidence] Capture message: $statusMessage"
                    }
                }

                if ($statusPhase -eq 'scenario-failed') {
                    $reason = if ([string]::IsNullOrWhiteSpace($statusMessage)) {
                        'unknown'
                    } else {
                        $statusMessage
                    }
                    throw "Capture scenario failed: $reason"
                }
            }
        }

        if ($edgeProcess -and -not $currentEdgeProcess) {
            if (-not $reportedLauncherExit) {
                Write-Output '[capture-mobile-evidence] Launcher process exited; continue waiting for reused browser instance'
                $reportedLauncherExit = $true
            }
            $edgeProcess = $null
        }

        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    if (-not (Test-Path $OutputPath)) {
        if (![string]::IsNullOrWhiteSpace($lastPageTitle)) {
            Write-Output "[capture-mobile-evidence] Last page title before timeout: $lastPageTitle"
        }
        if (![string]::IsNullOrWhiteSpace($lastWindowTitle)) {
            Write-Output "[capture-mobile-evidence] Last browser title before timeout: $lastWindowTitle"
        }
        throw 'Capture output file was not created before timeout'
    }

    Write-Output $OutputPath
} catch {
    if (Test-Path $viteLogPath) {
        Write-Output "=== Vite log tail ==="
        Get-Content -Path $viteLogPath -Tail 120
    }
    throw
} finally {
    if ($edgeProcess -and (Get-Process -Id $edgeProcess.Id -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $edgeProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Stop-Job $viteJob -ErrorAction SilentlyContinue | Out-Null
    Remove-Job $viteJob -Force -ErrorAction SilentlyContinue | Out-Null
}
