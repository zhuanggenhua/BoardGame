@echo off
REM One-click send "continue" to Kiro
REM Just double-click this file when Kiro stops

powershell -ExecutionPolicy Bypass -File "%~dp0send-continue.ps1" -MaxRetries 20
