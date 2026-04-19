# Send "continue" to Kiro - One-Click Solution
# 
# Usage: Just run this script when Kiro stops
#   powershell -ExecutionPolicy Bypass -File scripts/send-continue.ps1

param(
    [int]$MaxRetries = 20
)

$CountFile = ".kiro-continue-count.json"

Add-Type -AssemblyName System.Windows.Forms

# Load count
$count = 0
if (Test-Path $CountFile) {
    try {
        $data = Get-Content $CountFile -Raw | ConvertFrom-Json
        $count = $data.count
    } catch {}
}

# Check max retries
if ($count -ge $MaxRetries) {
    Write-Host "Max retries reached ($MaxRetries)" -ForegroundColor Red
    Write-Host "Press any key to reset count or Ctrl+C to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    $count = 0
}

# Increment count
$count++
$data = @{ count = $count; lastUpdate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") }
$data | ConvertTo-Json | Set-Content $CountFile

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Send 'continue' to Kiro" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Count: $count/$MaxRetries" -ForegroundColor Yellow
Write-Host ""

# Find Kiro window
$kiroProcess = Get-Process | Where-Object { $_.MainWindowTitle -like "*Kiro*" } | Select-Object -First 1

if ($null -eq $kiroProcess) {
    Write-Host "Kiro window not found!" -ForegroundColor Red
    Write-Host "Please make sure Kiro is running" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Found Kiro: $($kiroProcess.MainWindowTitle)" -ForegroundColor Green
Write-Host ""

try {
    # Set clipboard
    [System.Windows.Forms.Clipboard]::SetText("continue")
    Write-Host "1. Copied 'continue' to clipboard" -ForegroundColor Gray
    
    # Activate window (without changing window state)
    Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32API {
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
            [DllImport("user32.dll")]
            public static extern bool IsIconic(IntPtr hWnd);
            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        }
"@
    
    # Only restore if minimized, otherwise just activate
    if ([Win32API]::IsIconic($kiroProcess.MainWindowHandle)) {
        [Win32API]::ShowWindow($kiroProcess.MainWindowHandle, 9) | Out-Null
        Start-Sleep -Milliseconds 100
    }
    
    [Win32API]::SetForegroundWindow($kiroProcess.MainWindowHandle) | Out-Null
    Write-Host "2. Activated Kiro window" -ForegroundColor Gray
    
    Start-Sleep -Milliseconds 500
    
    # Paste
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Write-Host "3. Pasted text" -ForegroundColor Gray
    
    Start-Sleep -Milliseconds 200
    
    # Enter
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Write-Host "4. Pressed Enter" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "SUCCESS! Sent 'continue' to Kiro" -ForegroundColor Green
    Write-Host "Remaining retries: $($MaxRetries - $count)" -ForegroundColor Yellow
    
} catch {
    Write-Host ""
    Write-Host "FAILED: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
