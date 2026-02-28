@echo off
title ClawOps + Convos — Launcher
color 06

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     CLAWOPS + CONVOS  LAUNCHER  v3.0         ║
echo  ║        Starting all services...              ║
echo  ╚══════════════════════════════════════════════╝
echo.

echo [1/4] Target microservice    (port 8000) - RED window
start "ClawOps TARGET  :8000" cmd /k "color 0C && title ClawOps TARGET SERVICE :8000 && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 2 /nobreak >nul

echo [2/4] Orchestrator agent     (port 8001) - GREEN window
start "ClawOps AGENT   :8001" cmd /k "color 0A && title ClawOps ORCHESTRATOR :8001 && python -m uvicorn agent.orchestrator:app --host 0.0.0.0 --port 8001 --reload"
timeout /t 2 /nobreak >nul

echo [3/4] Convos bridge          (port 8002) - CYAN window
start "ClawOps CONVOS  :8002" cmd /k "color 0B && title ClawOps CONVOS BRIDGE :8002 && python agent/convos_bridge.py"
timeout /t 2 /nobreak >nul

echo [4/4] React dashboard        (port 3000) - YELLOW window
start "ClawOps DASHBOARD :3000" cmd /k "color 0E && title ClawOps DASHBOARD :3000 && cd frontend && npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   All services running!                              ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║   Dashboard    →  http://localhost:3000              ║
echo  ║   Target API   →  http://localhost:8000              ║
echo  ║   Orchestrator →  http://localhost:8001              ║
echo  ║   Convos Bridge→  http://localhost:8002              ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║   Convos Chat  →  Use dashboard right panel          ║
echo  ║   Test bridge  →  POST localhost:8002/chat           ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

echo Opening dashboard in browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo Press any key to close this launcher (services keep running)
pause >nul
