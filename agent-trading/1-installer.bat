@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Installation des composants de l'agent...
py -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo ERREUR : Python n'est pas installe ou pas trouve.
  echo Installez-le depuis https://www.python.org/downloads en cochant "Add Python to PATH".
) else (
  echo.
  echo Installation terminee. Vous pouvez lancer 2-tester.bat
)
pause
