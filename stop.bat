@echo off
title LP Tani - Stop Server
cd /d "%~dp0"

rem Port bisa diubah lewat argumen, contoh: stop.bat 8080
set "PORT=%~1"
if "%PORT%"=="" set "PORT=5500"

echo Mencari proses yang memakai port %PORT% ...

powershell -NoProfile -Command "$pids = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 } | Select-Object -ExpandProperty OwningProcess -Unique; if ($pids) { $pids | ForEach-Object { Write-Host ('  Menghentikan proses PID ' + $_ + ' ...'); Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } else { Write-Host '  Tidak ada proses ditemukan lewat PowerShell.' }"

rem Fallback netstat (untuk sistem tanpa Get-NetTCPConnection)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  echo   Menghentikan proses PID %%a ...
  taskkill /F /PID %%a >nul 2>nul
)

powershell -NoProfile -Command "Start-Sleep -Seconds 2"
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 }; $alive = $c | Where-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }; if ($alive) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo.
  echo Port %PORT% masih dipakai. Coba jalankan stop.bat sebagai Administrator.
) else (
  echo.
  echo Port %PORT% sudah bebas. Silakan jalankan start.bat lagi.
)
pause
