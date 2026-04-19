[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet(
        'smashup-tutorial-mobile-landscape',
        'summonerwars-tutorial-phone-landscape',
        'summonerwars-mobile-10-phone-landscape-board',
        'summonerwars-mobile-11-hand-magnify-open',
        'summonerwars-mobile-12-phase-detail-open',
        'summonerwars-mobile-13-action-log-open',
        'summonerwars-mobile-20-tablet-landscape-board',
        'smashup-4p-mobile-attached-actions',
        'smashup-4p-mobile-05-attached-actions',
        'smashup-4p-mobile-07-minion-long-press',
        'smashup-4p-mobile-08-base-long-press',
        'smashup-4p-mobile-09-base-ongoing-long-press',
        'smashup-4p-mobile-10-attached-action-long-press',
        'smashup-4p-mobile-11-hand-long-press',
        'smashup-4p-mobile-12-tablet-landscape'
    )]
    [string]$Scenario,

    [string]$BrowserPath,
    [int]$VitePort = 6173,
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$phoneLandscapeWidth = 936
$phoneLandscapeHeight = 432
$tabletLandscapeWidth = 1024
$tabletLandscapeHeight = 768

# Reuse existing E2E evidence roots. For scenarios without any prior screenshots,
# fall back to stable ASCII case directories so the helper can still write files.
$scenarioMap = @{
    'smashup-tutorial-mobile-landscape' = @{
        Route = '/play/smashup/tutorial'
        EvidenceRoot = 'test-results/evidence-screenshots/smashup/smashup-tutorial.e2e'
        CaseDirName = 'smashup-tutorial-mobile-landscape'
        FileName = 'tutorial-mobile-landscape.png'
        FolderLocatorFileName = ''
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'summonerwars-tutorial-phone-landscape' = @{
        Route = '/play/summonerwars/tutorial'
        EvidenceRoot = 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e'
        CaseDirName = 'summonerwars-mobile-phone-landscape'
        FileName = '10-phone-landscape-board.png'
        FolderLocatorFileName = ''
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'summonerwars-mobile-10-phone-landscape-board' = @{
        Route = '/play/summonerwars/tutorial'
        EvidenceRoot = 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e'
        CaseDirName = 'summonerwars-mobile-phone-landscape'
        FileName = '10-phone-landscape-board.png'
        FolderLocatorFileName = ''
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'summonerwars-mobile-11-hand-magnify-open' = @{
        Route = '/play/summonerwars/tutorial'
        EvidenceRoot = 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e'
        CaseDirName = 'summonerwars-mobile-phone-landscape'
        FileName = '11-phone-hand-magnify-open.png'
        FolderLocatorFileName = '10-phone-landscape-board.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'summonerwars-mobile-12-phase-detail-open' = @{
        Route = '/play/summonerwars/tutorial'
        EvidenceRoot = 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e'
        CaseDirName = 'summonerwars-mobile-phone-landscape'
        FileName = '12-phone-phase-detail-open.png'
        FolderLocatorFileName = '10-phone-landscape-board.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'summonerwars-mobile-13-action-log-open' = @{
        Route = '/play/summonerwars/tutorial'
        EvidenceRoot = 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e'
        CaseDirName = 'summonerwars-mobile-phone-landscape'
        FileName = '13-phone-action-log-open.png'
        FolderLocatorFileName = '10-phone-landscape-board.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'summonerwars-mobile-20-tablet-landscape-board' = @{
        Route = '/play/summonerwars/tutorial'
        EvidenceRoot = 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e'
        CaseDirName = 'summonerwars-mobile-phone-landscape'
        FileName = '20-tablet-landscape-board.png'
        FolderLocatorFileName = '10-phone-landscape-board.png'
        Width = $tabletLandscapeWidth
        Height = $tabletLandscapeHeight
        ForceCoarsePointer = $true
    }
    'smashup-4p-mobile-attached-actions' = @{
        Route = '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true'
        EvidenceRoot = 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e'
        CaseDirName = ''
        FileName = '05-mobile-single-tap-expands-attached-actions.png'
        FolderLocatorFileName = '04-mobile-landscape-layout.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'smashup-4p-mobile-05-attached-actions' = @{
        Route = '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true'
        EvidenceRoot = 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e'
        CaseDirName = ''
        FileName = '05-mobile-single-tap-expands-attached-actions.png'
        FolderLocatorFileName = '04-mobile-landscape-layout.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'smashup-4p-mobile-07-minion-long-press' = @{
        Route = '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true'
        EvidenceRoot = 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e'
        CaseDirName = ''
        FileName = '07-mobile-minion-long-press-magnify.png'
        FolderLocatorFileName = '04-mobile-landscape-layout.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'smashup-4p-mobile-08-base-long-press' = @{
        Route = '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true'
        EvidenceRoot = 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e'
        CaseDirName = ''
        FileName = '08-mobile-base-long-press-magnify.png'
        FolderLocatorFileName = '04-mobile-landscape-layout.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'smashup-4p-mobile-09-base-ongoing-long-press' = @{
        Route = '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true'
        EvidenceRoot = 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e'
        CaseDirName = ''
        FileName = '09-mobile-base-ongoing-long-press-magnify.png'
        FolderLocatorFileName = '04-mobile-landscape-layout.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'smashup-4p-mobile-10-attached-action-long-press' = @{
        Route = '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true'
        EvidenceRoot = 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e'
        CaseDirName = ''
        FileName = '10-mobile-attached-action-long-press-magnify.png'
        FolderLocatorFileName = '04-mobile-landscape-layout.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'smashup-4p-mobile-11-hand-long-press' = @{
        Route = '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true'
        EvidenceRoot = 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e'
        CaseDirName = ''
        FileName = '11-mobile-hand-long-press-magnify.png'
        FolderLocatorFileName = '04-mobile-landscape-layout.png'
        Width = $phoneLandscapeWidth
        Height = $phoneLandscapeHeight
        ForceCoarsePointer = $true
    }
    'smashup-4p-mobile-12-tablet-landscape' = @{
        Route = '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true'
        EvidenceRoot = 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e'
        CaseDirName = ''
        FileName = '12-tablet-landscape-layout.png'
        FolderLocatorFileName = '04-mobile-landscape-layout.png'
        Width = $tabletLandscapeWidth
        Height = $tabletLandscapeHeight
        ForceCoarsePointer = $true
    }
}

function Resolve-BrowserPath {
    param([string]$PreferredPath)

    if ($PreferredPath) {
        if (!(Test-Path $PreferredPath)) {
            throw "Browser does not exist: $PreferredPath"
        }
        return $PreferredPath
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

    throw 'No supported browser found. Use -BrowserPath to provide Edge or Chrome.'
}

function Build-CaptureUrl {
    param(
        [hashtable]$Config,
        [string]$ScenarioName,
        [int]$Port
    )

    $separator = '?'
    if ($Config.Route.Contains('?')) {
        $separator = '&'
    }

    $scenarioParam = [uri]::EscapeDataString($ScenarioName)
    return "http://127.0.0.1:$Port$($Config.Route)$separator" + "bgCapture=$scenarioParam"
}

function Resolve-EvidenceFolderPath {
    param(
        [string]$Root,
        [hashtable]$Config
    )

    $evidenceRoot = [System.IO.Path]::GetFullPath((Join-Path $Root $Config.EvidenceRoot))
    if (!(Test-Path $evidenceRoot)) {
        throw "Evidence root does not exist: $evidenceRoot"
    }

    if ($Config.CaseDirName) {
        $caseDir = [System.IO.Path]::GetFullPath((Join-Path $evidenceRoot $Config.CaseDirName))
        New-Item -ItemType Directory -Force -Path $caseDir | Out-Null
        return $caseDir
    }

    $locatorCandidates = @($Config.FileName)
    if ($Config.FolderLocatorFileName) {
        $locatorCandidates += $Config.FolderLocatorFileName
    }

    foreach ($candidateFileName in $locatorCandidates) {
        $existingFile = Get-ChildItem -Path $evidenceRoot -Recurse -File -Filter $candidateFileName -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($existingFile) {
            return $existingFile.Directory.FullName
        }
    }

    $directories = @(Get-ChildItem -Path $evidenceRoot -Directory -ErrorAction SilentlyContinue)
    if ($directories.Count -eq 1) {
        return $directories[0].FullName
    }

    throw "Unable to resolve evidence folder for file '$($Config.FileName)' under '$evidenceRoot'."
}

$config = $scenarioMap[$Scenario]
if ($null -eq $config) {
    throw "Unknown scenario: $Scenario"
}

$browser = Resolve-BrowserPath -PreferredPath $BrowserPath
$outputDir = Resolve-EvidenceFolderPath -Root $repoRoot -Config $config
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $outputDir $config.FileName))
$captureUrl = Build-CaptureUrl -Config $config -ScenarioName $Scenario -Port $VitePort

Write-Host "[capture-mobile-evidence] repo root: $repoRoot"
Write-Host "[capture-mobile-evidence] browser: $browser"
Write-Host "[capture-mobile-evidence] scenario: $Scenario"
Write-Host "[capture-mobile-evidence] output file: $outputPath"
Write-Host "[capture-mobile-evidence] capture url: $captureUrl"

$scriptArgs = @(
    '-ExecutionPolicy', 'Bypass',
    '-File', (Join-Path $repoRoot 'scripts\infra\capture-mobile-evidence-browser.ps1'),
    '-Port', $VitePort,
    '-Url', $captureUrl,
    '-OutputPath', $outputPath,
    '-Root', $repoRoot,
    '-EdgePath', $browser,
    '-ReadyTimeoutSec', 30,
    '-CaptureTimeoutSec', $TimeoutSeconds,
    '-WindowWidth', $config.Width,
    '-WindowHeight', $config.Height
)

if ($config.ForceCoarsePointer) {
    $scriptArgs += '-ForceCoarsePointer'
}

& powershell @scriptArgs
