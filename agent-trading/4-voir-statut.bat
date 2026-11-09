@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -m agent_trading statut
pause
