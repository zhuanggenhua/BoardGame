@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-figma-mcp.ps1" -OpenWindow %*
