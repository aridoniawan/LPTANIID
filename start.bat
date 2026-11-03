@echo off
title LP Tani - Local Server
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js tidak ditemukan.
  echo Install dulu dari https://nodejs.org lalu jalankan lagi file ini.
  pause
  exit /b 1
)

rem Port mengikuti variabel PORT (default 5500), sama seperti server.js
if "%PORT%"=="" set "PORT=5500"

echo Memastikan port %PORT% bebas ...
powershell -NoProfile -Command "$pids = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 } | Select-Object -ExpandProperty OwningProcess -Unique; if ($pids) { $pids | ForEach-Object { Write-Host ('  Menghentikan proses lama di port %PORT% - PID ' + $_ + ' ...'); Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } else { Write-Host '  Port sudah bebas.' }"

rem Fallback netstat (untuk sistem tanpa Get-NetTCPConnection)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  echo   Menghentikan proses lama di port %PORT% - PID %%a ...
  taskkill /F /PID %%a >nul 2>nul
)

echo.
echo Menjalankan server LP Tani di http://localhost:%PORT% ...
echo Tutup jendela ini untuk menghentikan server.
echo.
node server.js
pause
