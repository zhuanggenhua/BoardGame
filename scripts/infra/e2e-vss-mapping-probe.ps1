param([Parameter(Mandatory = $true)][string]$PipeName)

$ErrorActionPreference = 'Stop'
if ($PipeName -notmatch '^boardgame-vss-probe-[0-9a-f]{32}$') { throw 'Invalid probe pipe name.' }
if (Test-Path 'X:\') { throw 'X: is already in use.' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class E2eProbeDosDevice {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern uint QueryDosDevice(string name, StringBuilder target, int size);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool DefineDosDevice(uint flags, string name, string target);
}
'@
$client = [IO.Pipes.NamedPipeClientStream]::new('.', $PipeName, [IO.Pipes.PipeDirection]::In, [IO.Pipes.PipeOptions]::Asynchronous)
$device = $null
$rawTarget = $null
$canRelease = $true
try {
    $client.Connect(30000)
    $reader = [IO.StreamReader]::new($client)
    $read = $reader.ReadLineAsync()
    if (-not $read.Wait(40000)) { throw 'Timed out waiting for the snapshot.' }
    $payload = $read.Result | ConvertFrom-Json
    if ($payload.state -ne 'ready') { throw "VSS probe failed: $($payload | ConvertTo-Json -Compress)" }
    $device = [string]$payload.device
    if ($device -notmatch '^\\\\\?\\GLOBALROOT\\Device\\HarddiskVolumeShadowCopy\d+$') { throw 'Unexpected VSS device.' }
    Write-Output "SNAPSHOT_ID=$($payload.id)"
    $snapshotRoot = $device + '\gongzuo\webgame\BoardGame'
    $expectedRaw = '\??\' + $snapshotRoot.Substring(4).TrimEnd('\')
    & subst X: $snapshotRoot
    if ($LASTEXITCODE -ne 0) { throw 'Cannot map the snapshot to X:.' }
    $rawTarget = $expectedRaw
    $mapping = (& subst | Where-Object { $_ -like 'X:\:*' })
    $expected = $snapshotRoot.TrimEnd('\')
    if (-not $mapping) { throw 'Snapshot drive mapping is missing.' }
    $actual = ($mapping -split '=>', 2)[1].Trim().TrimEnd('\')
    if (-not $actual.Equals($expected, [StringComparison]::OrdinalIgnoreCase)) { throw 'Snapshot drive mapping could not be verified.' }
    $buffer = [Text.StringBuilder]::new(32768)
    if ([E2eProbeDosDevice]::QueryDosDevice('X:', $buffer, $buffer.Capacity) -eq 0) { throw 'Cannot inspect the created DOS mapping.' }
    if (-not $buffer.ToString().TrimEnd('\').Equals($expectedRaw, [StringComparison]::OrdinalIgnoreCase)) { throw 'The DOS mapping changed during verification.' }
    $rawTarget = $buffer.ToString()
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $node
    $start.WorkingDirectory = 'X:\'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.ArgumentList.Add('--input-type=module')
    $start.ArgumentList.Add('-e')
    $start.ArgumentList.Add('import("vite").then(() => console.log("VITE_IMPORT=PASS"))')
    $process = [Diagnostics.Process]::Start($start)
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(15000)) {
        $process.Kill()
        if (-not $process.WaitForExit(5000)) {
            $canRelease = $false
            Write-Warning "Probe process $($process.Id) is still alive; retaining X: mapping $rawTarget for snapshot $($payload.id)."
        }
        throw 'Node snapshot import timed out.'
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    Write-Output $stdout.Trim()
    if ($process.ExitCode -ne 0) { throw "Node snapshot import failed: $stderr" }
    if (-not [E2eProbeDosDevice]::DefineDosDevice(7, 'X:', $rawTarget)) { throw 'Could not release the exact probe mapping.' }
    $rawTarget = $null
    $readCleanup = $reader.ReadLineAsync()
    if (-not $readCleanup.Wait(55000)) { throw "Timed out waiting for cleanup of $($payload.id)" }
    $cleanup = $readCleanup.Result
    if (-not $cleanup) { throw "Missing cleanup result for $($payload.id)" }
    $cleanupPayload = $cleanup | ConvertFrom-Json
    if ($cleanupPayload.state -ne 'removed' -or $cleanupPayload.id -ne $payload.id) {
        throw "Probe snapshot cleanup failed or returned a different ID: $cleanup"
    }
    Write-Output "CLEANUP=$cleanup"
} finally {
    if ($canRelease -and $rawTarget) {
        if (-not [E2eProbeDosDevice]::DefineDosDevice(7, 'X:', $rawTarget)) { Write-Warning 'Unable to release the exact probe mapping.' }
    }
    $client.Dispose()
}
