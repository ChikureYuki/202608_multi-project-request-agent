@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

rem --- Settings (edit DATA_DIR if needed) ---
set "DATA_DIR=.\data\production"
set "OUT=.\output\report.html"
set "CONFIG=.\config\scoring.json"
set "EXTRA="

if /I "%~1"=="--dry-run" set "EXTRA=--dry-run"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "dist\cli.js" (
  echo [ERROR] dist\cli.js missing. Run: npm run build
  pause
  exit /b 1
)

if not exist "%DATA_DIR%" (
  echo [ERROR] Data folder missing: %DATA_DIR%
  echo         Copy CSV files from data\sample or add your production CSVs.
  pause
  exit /b 1
)

echo.
echo Creating development proposal report...
echo   Data: %DATA_DIR%
echo   Out:  %OUT%
if defined EXTRA echo   Mode: dry-run
echo.

if exist ".env" (
  node --env-file=.env dist\cli.js --data "%DATA_DIR%" --out "%OUT%" --config "%CONFIG%" %EXTRA%
) else (
  if not defined EXTRA (
    echo [WARN] .env not found. Set GOOGLE_API_KEY for LLM mode.
    echo        Free trial: scripts\report.bat --dry-run
    echo.
  )
  node dist\cli.js --data "%DATA_DIR%" --out "%OUT%" --config "%CONFIG%" %EXTRA%
)

if errorlevel 1 (
  echo.
  echo [ERROR] Report generation failed.
  pause
  exit /b 1
)

echo.
echo Done: %OUT%
if exist "%OUT%" start "" "%OUT%"
echo.
pause
exit /b 0
