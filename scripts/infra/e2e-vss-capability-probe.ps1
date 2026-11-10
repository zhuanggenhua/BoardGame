param(
    [Parameter(Mandatory = $true)][string]$PipeName,
    [ValidateRange(1, 120)][int]$HoldSeconds = 5
)

$ErrorActionPreference = 'Stop'
if ($PipeName -notmatch '^boardgame-vss-probe-[0-9a-f]{32}$') { throw 'Invalid probe pipe name.' }
$pipe = [System.IO.Pipes.NamedPipeServerStream]::new(
    $PipeName, [System.IO.Pipes.PipeDirection]::Out, 1,
    [System.IO.Pipes.PipeTransmissionMode]::Byte, [System.IO.Pipes.PipeOptions]::Asynchronous
)
$writer = $null
$shadowId = $null
$failed = $false
$script:stage = 'connect'
try {
    $connection = $pipe.BeginWaitForConnection($null, $null)
    if (-not $connection.AsyncWaitHandle.WaitOne([TimeSpan]::FromMinutes(10))) { throw 'Probe client did not connect.' }
    $pipe.EndWaitForConnection($connection)
    $writer = [System.IO.StreamWriter]::new($pipe, [System.Text.UTF8Encoding]::new($false))
    $writer.AutoFlush = $true

    # 此试验只在系统没有其他卷影副本时运行，避免挤占已有副本。
    $script:stage = 'inspect-existing-shadows'
    if (@(Get-CimInstance Win32_ShadowCopy).Count -ne 0) { throw 'Existing shadow copies found; refusing the capability probe.' }
    $script:stage = 'inspect-volume'
    $volume = Get-CimInstance Win32_Volume -Filter "DriveLetter='D:'"
    if (-not $volume -or $volume.FreeSpace -lt 2GB) { throw 'D: has insufficient free space.' }
    $allVolumes = @(Get-CimInstance Win32_Volume)
    $script:stage = 'inspect-shadow-storage'
    foreach ($store in @(Get-CimInstance Win32_ShadowStorage | Where-Object { $_.Volume.DeviceID -eq $volume.DeviceID })) {
        $diff = $allVolumes | Where-Object { $_.DeviceID -eq $store.DiffVolume.DeviceID } | Select-Object -First 1
        if (-not $diff -or $null -eq $diff.FreeSpace -or $diff.FreeSpace -lt 2GB) { throw 'Shadow storage volume has insufficient or unknown free space.' }
        if ($store.MaxSpace -gt 0 -and $store.MaxSpace -ne [UInt64]::MaxValue -and
            ($store.MaxSpace - $store.UsedSpace) -lt 2GB) { throw 'Shadow storage quota has less than 2 GiB available.' }
    }
    $script:stage = 'create-shadow'
    $created = Invoke-CimMethod -ClassName Win32_ShadowCopy -MethodName Create -Arguments @{
        Volume = 'D:\'; Context = 'ClientAccessible'
    }
    if ($created.ReturnValue -ne 0 -or -not $created.ShadowID) { throw "VSS create failed: return value $($created.ReturnValue)" }
    $candidate = [string]$created.ShadowID
    if ($candidate -notmatch '^\{[0-9A-Fa-f-]{36}\}$') { throw 'Invalid snapshot ID returned.' }
    $shadowId = $candidate
    $script:stage = 'inspect-created-shadow'
    $shadow = Get-CimInstance Win32_ShadowCopy -Filter "ID='$shadowId'"
    if (-not $shadow -or -not $shadow.DeviceObject) { throw "Created snapshot cannot be queried: $shadowId" }
    $writer.WriteLine((@{ state = 'ready'; id = $shadowId; device = $shadow.DeviceObject } | ConvertTo-Json -Compress))
    Start-Sleep -Seconds $HoldSeconds
} catch {
    $failed = $true
    if ($writer) {
        $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
        $diagnostic = @{ state = 'error'; message = $_.Exception.Message; id = $shadowId; stage = $script:stage;
            errorId = $_.FullyQualifiedErrorId; hresult = $_.Exception.HResult;
            line = $_.InvocationInfo.ScriptLineNumber;
            elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
        try { $writer.WriteLine(($diagnostic | ConvertTo-Json -Compress)) } catch {}
    }
} finally {
    if ($shadowId) {
        try {
            $owned = Get-CimInstance Win32_ShadowCopy -Filter "ID='$shadowId'"
            if ($owned) { Remove-CimInstance -InputObject $owned }
            $remaining = @(Get-CimInstance Win32_ShadowCopy -Filter "ID='$shadowId'")
            if ($remaining.Count -ne 0) { throw 'Created snapshot still exists after cleanup.' }
            $storageAfter = @(Get-CimInstance Win32_ShadowStorage | ForEach-Object {
                @{ source = $_.Volume.DeviceID; diff = $_.DiffVolume.DeviceID; used = $_.UsedSpace; allocated = $_.AllocatedSpace; maximum = $_.MaxSpace }
            })
            if ($writer) { $writer.WriteLine((@{ state = 'removed'; id = $shadowId; storage = $storageAfter } | ConvertTo-Json -Depth 5 -Compress)) }
        } catch {
            $failed = $true
            if ($writer) { try { $writer.WriteLine((@{ state = 'cleanup-error'; id = $shadowId; message = $_.Exception.Message } | ConvertTo-Json -Compress)) } catch {} }
        }
    }
    if ($writer) { try { $writer.Dispose() } catch {} } else { $pipe.Dispose() }
}
if ($failed) { exit 1 }
