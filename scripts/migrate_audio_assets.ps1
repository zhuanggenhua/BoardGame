param(
    [string]$SourceRoot = "d:\\gongzuo\\web\\BordGame\\BordGameAsset\\SoundEffect",
    [string]$DestRoot = "d:\\gongzuo\\web\\BordGame\\public\\assets\\common\\audio",
    [string]$LogPath = "d:\\gongzuo\\web\\BordGame\\docs\\audio\\migration-log.csv",
    [int]$Sample = 5,
    [switch]$DryRun
)

$allowed = @('.wav','.mp3','.ogg','.flac','.aiff','.aif','.m4a','.aac')
$sourceZips = Join-Path $SourceRoot "_source_zips"
$miniGames = Join-Path $SourceRoot "Mini Games Sound Effects and Music Pack"
$miniPackName = "Mini Games Sound Effects and Music Pack"

function Normalize-Path([string]$path) {
    return $path -replace '\\','/'
}

function Get-RelativePath([string]$fullPath, [string]$basePath) {
    $fullNorm = Normalize-Path ([System.IO.Path]::GetFullPath($fullPath))
    $baseNorm = Normalize-Path ([System.IO.Path]::GetFullPath($basePath))
    $baseLower = $baseNorm.TrimEnd('/').ToLowerInvariant()
    $fullLower = $fullNorm.ToLowerInvariant()
    $prefixLower = $baseLower + '/'
    $index = $fullLower.IndexOf($prefixLower)
    if ($index -ge 0) {
        return $fullNorm.Substring($index + $prefixLower.Length)
    }
    return $fullNorm
}

function Get-MagicElement([string]$folderName) {
    $lower = $folderName.ToLower()
    if ($lower -match 'fire') { return 'fire' }
    if ($lower -match 'water') { return 'water' }
    if ($lower -match 'light') { return 'lightning' }
    if ($lower -match 'ice') { return 'ice' }
    if ($lower -match 'poison') { return 'poison' }
    if ($lower -match 'dark') { return 'dark' }
    if ($lower -match 'rock') { return 'rock' }
    if ($lower -match 'wind') { return 'wind' }
    return 'general'
}

function Get-MonsterAction([string]$fileName) {
    $lower = $fileName.ToLower()
    if ($lower -match 'receiveattack|recieveattack|hit') { return 'impact' }
    if ($lower -match 'attack') { return 'attack' }
    if ($lower -match 'death') { return 'death' }
    if ($lower -match 'shout|scream|grunt') { return 'shout' }
    if ($lower -match 'growl') { return 'growl' }
    if ($lower -match 'breathing') { return 'breath' }
    if ($lower -match 'movement|flying|spinning') { return 'movement' }
    if ($lower -match 'footstep') { return 'footstep' }
    return 'general'
}

function Get-TargetPath($file) {
    $full = $file.FullName
    $name = $file.Name
    $ext = [System.IO.Path]::GetExtension($full).ToLower()

    if (-not ($allowed -contains $ext)) { return $null }
    if ($name -like '._*') { return $null }
    if ($name -match 'Preview') { return $null }

    $path = Normalize-Path $full
    if ($path -match '/__MACOSX/') { return $null }
    if ($path -match '/AUDIO/SFX/Engine-Car/' -or $path -match '/AUDIO/SFX/Helicopter/' -or $path -match '/AUDIO/SFX/Sports/') { return $null }

    if ($path -match '/_source_zips/') {
        $rel = Normalize-Path (Get-RelativePath $full $sourceZips)

        if ($rel -match '^music/([^/]+)/(.+)$') {
            $genre = $matches[1]
            $tail = $matches[2]
            return Join-Path $DestRoot (("bgm/$genre/$tail") -replace '/','\\')
        }

        if ($rel -match '^sfx/cards/Decks and Cards Sound FX Pack/Background Loops/(.+)$') {
            $tail = $matches[1]
            return Join-Path $DestRoot (("sfx/cards/loops/Decks and Cards Sound FX Pack/$tail") -replace '/','\\')
        }
        if ($rel -match '^sfx/cards/Decks and Cards Sound FX Pack/Cards/(.+)$') {
            $tail = $matches[1]
            return Join-Path $DestRoot (("sfx/cards/handling/Decks and Cards Sound FX Pack/$tail") -replace '/','\\')
        }
        if ($rel -match '^sfx/cards/Decks and Cards Sound FX Pack/Coins/(.+)$') {
            $tail = $matches[1]
            return Join-Path $DestRoot (("sfx/coins/Decks and Cards Sound FX Pack/$tail") -replace '/','\\')
        }
        if ($rel -match '^sfx/cards/Decks and Cards Sound FX Pack/Dice/(.+)$') {
            $tail = $matches[1]
            return Join-Path $DestRoot (("sfx/dice/Decks and Cards Sound FX Pack/$tail") -replace '/','\\')
        }
        if ($rel -match '^sfx/cards/Decks and Cards Sound FX Pack/FX/(.+)$') {
            $tail = $matches[1]
            return Join-Path $DestRoot (("sfx/cards/fx/Decks and Cards Sound FX Pack/$tail") -replace '/','\\')
        }
        if ($rel -match '^sfx/cards/Decks and Cards Sound FX Pack/FX/Looped/(.+)$') {
            $tail = $matches[1]
            return Join-Path $DestRoot (("sfx/cards/fx/Decks and Cards Sound FX Pack/$tail") -replace '/','\\')
        }
        if ($rel -match '^sfx/cards/Decks and Cards Sound FX Pack/Token and Piece/(.+)$') {
            $tail = $matches[1]
            return Join-Path $DestRoot (("sfx/token/Decks and Cards Sound FX Pack/$tail") -replace '/','\\')
        }

        if ($rel -match '^sfx/magic/([^/]+)/(.+)$') {
            $folder = $matches[1]
            $tail = $matches[2]
            $element = Get-MagicElement $folder
            return Join-Path $DestRoot (("sfx/magic/$element/$folder/$tail") -replace '/','\\')
        }

        if ($rel -match '^sfx/monsters/(.+)$') {
            $tail = $matches[1]
            if ($tail -notmatch '/') {
                $action = Get-MonsterAction $tail
                return Join-Path $DestRoot (("sfx/monster/$action/monsters/$tail") -replace '/','\\')
            }
            $parts = $tail.Split('/')
            $pack = $parts[0]
            $rest = $tail.Substring($pack.Length + 1)
            return Join-Path $DestRoot (("sfx/monster/general/$pack/$rest") -replace '/','\\')
        }

        if ($rel -match '^sfx/combat/(.+)$') { return Join-Path $DestRoot (("sfx/combat/general/$($matches[1])") -replace '/','\\') }
        if ($rel -match '^sfx/cyberpunk/(.+)$') { return Join-Path $DestRoot (("sfx/cyberpunk/$($matches[1])") -replace '/','\\') }
        if ($rel -match '^sfx/fantasy/(.+)$') { return Join-Path $DestRoot (("sfx/fantasy/$($matches[1])") -replace '/','\\') }
        if ($rel -match '^sfx/steampunk/(.+)$') { return Join-Path $DestRoot (("sfx/steampunk/$($matches[1])") -replace '/','\\') }
        if ($rel -match '^sfx/survival/(.+)$') { return Join-Path $DestRoot (("sfx/ambient/$($matches[1])") -replace '/','\\') }
        if ($rel -match '^sfx/puzzle/(.+)$') { return Join-Path $DestRoot (("sfx/puzzle/$($matches[1])") -replace '/','\\') }
        if ($rel -match '^sfx/player_status/(.+)$') { return Join-Path $DestRoot (("sfx/status/general/$($matches[1])") -replace '/','\\') }
        if ($rel -match '^sfx/other/(.+)$') { return Join-Path $DestRoot (("sfx/system/general/$($matches[1])") -replace '/','\\') }
        if ($rel -match '^sfx/ui/(.+)$') { return Join-Path $DestRoot (("sfx/ui/general/$($matches[1])") -replace '/','\\') }
    }

    if ($path -match '/Mini Games Sound Effects and Music Pack/') {
        $rel = Normalize-Path (Get-RelativePath $full $miniGames)
        if ($rel -match '^AUDIO/MUSIC-STINGER/(.+)$') {
            return Join-Path $DestRoot (("sfx/stinger/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Battle-Combat-Fight/(.+)$') {
            return Join-Path $DestRoot (("sfx/combat/general/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Card and Board Games/(.+)$') {
            return Join-Path $DestRoot (("sfx/cards/handling/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/UI/(.+)$') {
            return Join-Path $DestRoot (("sfx/ui/general/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Object Hit-Pick up-Drop-Collect/(.+)$') {
            return Join-Path $DestRoot (("sfx/foley/object/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Footstep-Jump/(.+)$') {
            return Join-Path $DestRoot (("sfx/foley/object/footstep/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Build-Collapse/(.+)$') {
            return Join-Path $DestRoot (("sfx/foley/build/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Write-Draw-Paint-Erase/(.+)$') {
            return Join-Path $DestRoot (("sfx/foley/write/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Generic Swoosh/(.+)$') {
            return Join-Path $DestRoot (("sfx/foley/swoosh/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Pop/(.+)$') {
            return Join-Path $DestRoot (("sfx/ui/click/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Voice/(.+)$') {
            return Join-Path $DestRoot (("sfx/voice/$miniPackName/$($matches[1])") -replace '/','\\')
        }
        if ($rel -match '^AUDIO/SFX/Applause-Firework-Confetti-Explosion/(.+)$') {
            return Join-Path $DestRoot (("sfx/system/celebrate/$miniPackName/$($matches[1])") -replace '/','\\')
        }
    }

    return $null
}

$logDir = Split-Path $LogPath -Parent
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logWriter = New-Object System.IO.StreamWriter($LogPath, $false, [System.Text.Encoding]::UTF8)
$logWriter.WriteLine('Source,Target')

$files = Get-ChildItem -Path $sourceZips, $miniGames -Recurse -File
$copied = 0
$skipped = 0
$bytes = 0
$sampleTargets = @()
$sampleSkipped = @()
$candidateSource = 0
$candidateMini = 0
$mappedSource = 0
$mappedMini = 0

foreach ($file in $files) {
    $normPath = Normalize-Path $file.FullName
    $isSource = $normPath -match '/_source_zips/'
    $isMini = $normPath -match '/Mini Games Sound Effects and Music Pack/'
    if ($allowed -contains $file.Extension.ToLower()) {
        if ($isSource) { $candidateSource++ }
        elseif ($isMini) { $candidateMini++ }
    }

    $target = Get-TargetPath $file
    if (-not $target) {
        if ($DryRun -and $sampleSkipped.Count -lt $Sample -and ($allowed -contains $file.Extension.ToLower())) {
            $path = Normalize-Path $file.FullName
            $rel = $null
            if ($path -match '/_source_zips/') {
                $rel = Normalize-Path (Get-RelativePath $file.FullName $sourceZips)
            } elseif ($path -match '/Mini Games Sound Effects and Music Pack/') {
                $rel = Normalize-Path (Get-RelativePath $file.FullName $miniGames)
            }
            $sampleSkipped += [pscustomobject]@{ Source = $file.FullName; Rel = $rel }
        }
        $skipped++
        continue
    }

    if ($isSource) { $mappedSource++ }
    elseif ($isMini) { $mappedMini++ }

    $targetDir = Split-Path $target -Parent
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
        Copy-Item -Path $file.FullName -Destination $target -Force
    }

    if ($DryRun -and $sampleTargets.Count -lt $Sample) {
        $sampleTargets += [pscustomobject]@{ Source = $file.FullName; Target = $target }
    }

    $sourceEscaped = $file.FullName.Replace('"','""')
    $targetEscaped = $target.Replace('"','""')
    $logWriter.WriteLine(('"{0}","{1}"' -f $sourceEscaped, $targetEscaped))
    $copied++
    $bytes += $file.Length
}

$logWriter.Close()

$mb = [math]::Round($bytes / 1MB, 2)
Write-Output ("CopiedFiles=$copied")
Write-Output ("SkippedFiles=$skipped")
Write-Output ("CopiedMB=$mb")
Write-Output ("Log=$LogPath")
Write-Output ("CandidateSource=$candidateSource CandidateMini=$candidateMini")
Write-Output ("MappedSource=$mappedSource MappedMini=$mappedMini")

if ($DryRun) {
    if ($sampleTargets.Count -gt 0) {
        Write-Output "SampleTargets=Begin"
        $sampleTargets | ForEach-Object { Write-Output ("Source={0} Target={1}" -f $_.Source, $_.Target) }
        Write-Output "SampleTargets=End"
    }
    if ($sampleSkipped.Count -gt 0) {
        Write-Output "SampleSkipped=Begin"
        $sampleSkipped | ForEach-Object { Write-Output ("Source={0} Rel={1}" -f $_.Source, $_.Rel) }
        Write-Output "SampleSkipped=End"
    }
    Write-Output "DryRun=1"
}
