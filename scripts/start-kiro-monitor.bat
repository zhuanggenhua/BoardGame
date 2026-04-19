@echo off
REM Kiro Auto-Continue Monitor Startup Script

echo ========================================
echo    Kiro Auto-Continue Monitor
echo ========================================
echo.
echo Starting monitoring script...
echo.

REM Run PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0kiro-auto-paste.ps1" -MaxRetries 20 -CheckInterval 60 -Timeout 120

pause
