@echo off
title ClawOps + Convos — Setup
color 06

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     CLAWOPS + CONVOS  SETUP  v3.0            ║
echo  ║   Autonomous SRE Agent with Convos Chat      ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ── Check Python ──────────────────────────────────────────
echo [1/6] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo       FAIL: Python not found.
    echo       Install Python 3.11+ from https://www.python.org/downloads/
    echo       IMPORTANT: check "Add Python to PATH" during install.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo       OK: %%v

:: ── Check Node ────────────────────────────────────────────
echo [2/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo       FAIL: Node.js not found.
    echo       Install Node.js 18+ from https://nodejs.org/
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo       OK: Node.js %%v

:: ── Python core deps ──────────────────────────────────────
echo [3/6] Installing Python dependencies...
pip install -r requirements.txt -q
if errorlevel 1 ( echo       FAIL: pip install failed & pause & exit /b 1 )
echo       OK: Core Python packages installed

:: ── Convos/XMTP deps ──────────────────────────────────────
echo [4/6] Installing Convos bridge dependencies...
pip install python-dotenv -q
echo       OK: python-dotenv installed
echo       NOTE: xmtp-mls-python install is optional (bridge runs in HTTP mode without it)
pip install xmtp-mls-python -q 2>nul && echo       OK: xmtp-mls-python installed || echo       INFO: xmtp-mls-python skipped - bridge will use HTTP mode

:: ── Frontend deps ─────────────────────────────────────────
echo [5/6] Installing frontend (npm)...
cd frontend
npm install --silent
if errorlevel 1 ( echo       FAIL: npm install failed & cd .. & pause & exit /b 1 )
cd ..
echo       OK: npm packages installed

:: ── Init dirs + DB ────────────────────────────────────────
echo [6/6] Initialising database and directories...
if not exist "logs"        mkdir logs
if not exist "postmortems" mkdir postmortems
python -c "import sys; sys.path.insert(0,''); from app.database import init_db; init_db()" 2>nul
if not exist ".env" (
    echo # ClawOps Environment Configuration > .env
    echo. >> .env
    echo # Optional: Add your XMTP wallet key to connect to real Convos >> .env
    echo # Leave blank to use HTTP demo mode >> .env
    echo XMTP_WALLET_KEY= >> .env
    echo CONVOS_MODE=http >> .env
    echo       OK: Created .env file (edit to add XMTP wallet key)
) else (
    echo       OK: .env already exists
)
echo       OK: Ready

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║            Setup complete!                       ║
echo  ╠══════════════════════════════════════════════════╣
echo  ║   Run START.bat to launch all services           ║
echo  ║   Edit .env to add XMTP_WALLET_KEY for           ║
echo  ║   real Convos integration (optional)             ║
echo  ╚══════════════════════════════════════════════════╝
echo.
pause
