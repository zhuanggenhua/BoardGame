# Kiro Auto-Continue Timer
# Automatically send "continue" at specified intervals
# Simple solution for network interruption recovery
#
# Usage:
#   Test (10 seconds):  npm run monitor:kiro:timer:test
#   20 minutes:         npm run monitor:kiro:timer:20min
#   30 minutes:         npm run monitor:kiro:timer:30min
#   Custom:             powershell -ExecutionPolicy Bypass -File scripts/kiro-auto-timer.ps1 -IntervalMinutes 15 -MaxRetries 30
#
# Parameters:
#   -IntervalMinutes: How often to send "continue" in minutes (default: 30)
#   -MaxRetries: Maximum number of times to send (default: 20)

param(
    [int]$IntervalMinutes = 30,  # Send "continue" every 30 minutes (default)
    [int]$MaxRetries = 20        # Maximum 20 retries (default)
)

$CountFile = ".kiro-timer-count.json"

Add-Type -AssemblyName System.Windows.Forms

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Get-RetryCount {
    if (Test-Path $CountFile) {
        try {
            $data = Get-Content $CountFile -Raw | ConvertFrom-Json
            return $data.count
        } catch {
            return 0
        }
    }
    return 0
}

function Set-RetryCount {
    param([int]$Count)
    $data = @{ count = $Count; lastUpdate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") }
    $data | ConvertTo-Json | Set-Content $CountFile
}

function Find-KiroWindow {
    $processes = Get-Process | Where-Object { $_.MainWindowTitle -like "*Kiro*" }
    if ($processes.Count -eq 0) { return $null }
    return $processes | Select-Object -First 1
}

function Send-Continue {
    param([System.Diagnostics.Process]$Process)
    
    try {
        # Set clipboard
        [System.Windows.Forms.Clipboard]::SetText("continue")
        
        # Activate window (without changing window state)
        Add-Type @"
            using System;
            using System.Runtime.InteropServices;
            public class Win32 {
                [DllImport("user32.dll")]
                public static extern bool SetForegroundWindow(IntPtr hWnd);
                [DllImport("user32.dll")]
                public static extern bool IsIconic(IntPtr hWnd);
                [DllImport("user32.dll")]
                public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            }
"@
        
        # Only restore if minimized, otherwise just activate
        if ([Win32]::IsIconic($Process.MainWindowHandle)) {
            [Win32]::ShowWindow($Process.MainWindowHandle, 9) | Out-Null  # SW_RESTORE
            Start-Sleep -Milliseconds 100
        }
        
        # Activate window (bring to front)
        [Win32]::SetForegroundWindow($Process.MainWindowHandle) | Out-Null
        Start-Sleep -Milliseconds 500
        
        # Paste and Enter
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 200
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        
        return $true
    } catch {
        Write-ColorOutput "Error: $_" "Red"
        return $false
    }
}

# Banner
$intervalSeconds = $IntervalMinutes * 60
$totalHours = [math]::Round($MaxRetries * $IntervalMinutes / 60, 1)

Write-ColorOutput "============================================" "Cyan"
Write-ColorOutput "   Kiro Auto-Continue Timer v5.0.0" "Cyan"
Write-ColorOutput "============================================" "Cyan"
Write-Host ""
Write-ColorOutput "Config:" "Yellow"
Write-ColorOutput "  Interval: $IntervalMinutes minutes ($intervalSeconds seconds)" "Gray"
Write-ColorOutput "  Max Retries: $MaxRetries times (about $totalHours hours)" "Gray"
Write-Host ""
Write-ColorOutput "How it works:" "Green"
Write-ColorOutput "  - Auto send 'continue' every $IntervalMinutes minutes" "Gray"
Write-ColorOutput "  - Network interruption recovery" "Gray"
Write-ColorOutput "  - Preserve fullscreen (only restore if minimized)" "Gray"
Write-Host ""
Write-ColorOutput "Press Ctrl+C to stop" "Green"
Write-ColorOutput "============================================" "Cyan"
Write-Host ""

$count = Get-RetryCount

if ($count -gt 0) {
    Write-ColorOutput "Found previous count: $count" "Yellow"
    $response = Read-Host "Continue from previous count? (Y/N, default: N)"
    if ($response -ne "Y" -and $response -ne "y") {
        Write-ColorOutput "Resetting count to 0" "Green"
        $count = 0
        Set-RetryCount -Count 0
    } else {
        Write-ColorOutput "Continuing from count: $count" "Green"
    }
    Write-Host ""
}

Write-ColorOutput "Timer started" "Green"
Write-Host ""

while ($true) {
    try {
        # Wait for interval
        $nextTime = (Get-Date).AddMinutes($IntervalMinutes).ToString("HH:mm:ss")
        Write-ColorOutput "Waiting $IntervalMinutes minutes... (next at $nextTime)" "Gray"
        Start-Sleep -Seconds $intervalSeconds
        
        # Check max retries
        if ($count -ge $MaxRetries) {
            Write-ColorOutput "Max retries reached ($MaxRetries)" "Red"
            Write-ColorOutput "Please check task status manually" "Yellow"
            break
        }
        
        # Find Kiro
        $kiroProcess = Find-KiroWindow
        
        if ($null -eq $kiroProcess) {
            Write-ColorOutput "Kiro window not found, skipping..." "Yellow"
            continue
        }
        
        # Send continue
        $count++
        Write-ColorOutput "Sending 'continue' (attempt $count/$MaxRetries)..." "Cyan"
        
        $success = Send-Continue -Process $kiroProcess
        
        if ($success) {
            Set-RetryCount -Count $count
            Write-ColorOutput "SUCCESS! Sent 'continue'" "Green"
            Write-ColorOutput "Remaining: $($MaxRetries - $count)" "Yellow"
        } else {
            Write-ColorOutput "FAILED" "Red"
        }
        
        Write-Host ""
        
    } catch {
        Write-ColorOutput "Error: $_" "Red"
    }
}

Write-Host ""
Write-ColorOutput "Timer stopped" "Yellow"
