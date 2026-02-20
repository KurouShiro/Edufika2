@echo off
setlocal
set ROOT=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%launch-schema-admin.ps1" %*
endlocal
