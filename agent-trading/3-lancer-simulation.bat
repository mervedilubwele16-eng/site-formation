@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Lancement de l'agent en SIMULATION (argent fictif).
echo Laissez cette fenetre ouverte. Pour arreter : Ctrl + C
echo.
py -m agent_trading run
pause
