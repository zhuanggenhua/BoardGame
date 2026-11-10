param(
    [Parameter(Mandatory = $true)][string]$PipeName
)

$ErrorActionPreference = 'Stop'
if ($PipeName -notmatch '^boardgame-vss-probe-[0-9a-f]{32}$') { throw 'Invalid probe pipe name.' }

# 只读预检：不创建、更改或删除影子副本。
$pipe = [System.IO.Pipes.NamedPipeServerStream]::new(
    $PipeName, [System.IO.Pipes.PipeDirection]::Out, 1,
    [System.IO.Pipes.PipeTransmissionMode]::Byte, [System.IO.Pipes.PipeOptions]::Asynchronous
)
$writer = $null
try {
    $connection = $pipe.BeginWaitForConnection($null, $null)
    if (-not $connection.AsyncWaitHandle.WaitOne([TimeSpan]::FromMinutes(2))) { throw 'Probe client did not connect.' }
    $pipe.EndWaitForConnection($connection)
    $writer = [System.IO.StreamWriter]::new($pipe, [System.Text.UTF8Encoding]::new($false))
    $writer.AutoFlush = $true
    $volumes = @(Get-CimInstance Win32_Volume | Select-Object DriveLetter, DeviceID, FreeSpace)
    $shadows = @(Get-CimInstance Win32_ShadowCopy | Select-Object ID, VolumeName, DeviceObject, InstallDate)
    $storage = @(Get-CimInstance Win32_ShadowStorage | ForEach-Object {
        [pscustomobject]@{
            sourceVolume = $_.Volume.DeviceID
            diffVolume = $_.DiffVolume.DeviceID
            used = $_.UsedSpace
            allocated = $_.AllocatedSpace
            maximum = $_.MaxSpace
        }
    })
    $payload = @{ state = 'ready'; volumes = $volumes; shadows = $shadows; storage = $storage }
    $writer.WriteLine(($payload | ConvertTo-Json -Depth 6 -Compress))
} catch {
    if ($writer) {
        $writer.WriteLine((@{ state = 'error'; message = $_.Exception.Message } | ConvertTo-Json -Compress))
    }
    exit 1
} finally {
    if ($writer) { $writer.Dispose() } else { $pipe.Dispose() }
}
