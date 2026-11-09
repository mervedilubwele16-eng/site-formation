@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Test de la strategie sur les vrais prix des derniers mois...
py -m agent_trading backtest --bars 5000
pause
