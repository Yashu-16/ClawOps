@echo off
title ClawOps — Stop All
color 04
echo.
echo  Stopping all ClawOps + Convos services...
echo.

for %%p in (8000 8001 8002 3000) do (
    for /f "tokens=5" %%x in ('netstat -ano ^| findstr ":%%p " ^| findstr LISTENING 2^>nul') do (
        taskkill /PID %%x /F >nul 2>&1
        echo  Stopped port %%p
    )
)

echo.
echo  All services stopped.
timeout /t 2 /nobreak >nul
