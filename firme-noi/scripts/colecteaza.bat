@echo off
REM Colectare firme noi + telefoane ANAF si export Excel pe ani (Windows).
REM Necesita Python 3.10+ (https://www.python.org/downloads/, bifeaza "Add to PATH").
REM
REM   scripts\colecteaza.bat          -> anul curent
REM   scripts\colecteaza.bat 2020     -> toti anii de la 2020 pana azi
REM
REM ANAF accepta ~1 cerere pe secunda: un an intreg dureaza ~1-2 ore la prima
REM rulare. Rularea poate fi oprita oricand (Ctrl+C); data viitoare continua de
REM unde a ramas si interogheaza doar CUI-urile noi.

setlocal
set PYTHONUTF8=1
cd /d "%~dp0\.."
python -m pip install -r requirements.txt || goto :eroare

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy"') do set AN=%%i
set START=%1
if "%START%"=="" set START=%AN%

python run.py probe --doar-anaf || goto :eroare
python run.py collect --source anaf_scan --dupa %START%-01-01 || goto :eroare
python run.py enrich || goto :eroare
python run.py verifica-telefoane
python run.py stats

for /L %%a in (%START%,1,%AN%) do (
  python run.py export --doar-firme --format xlsx --dupa %%a-01-01 --inainte %%a-12-31 --out export\%%a\Firme-noi-%%a.xlsx
  python run.py export --doar-firme --format xlsx --dupa %%a-01-01 --inainte %%a-12-31 --with-phone --fara-suspecte --fara-comune --out export\%%a\Firme-noi-%%a-cu-telefon.xlsx
  python run.py export --dupa %%a-01-01 --inainte %%a-12-31 --out export\%%a\Toate-inregistrarile-%%a.csv
  python run.py stats --an %%a > export\%%a\STATISTICI.txt
)

echo.
echo Gata. Fisierele Excel sunt in folderul "export", cate un subfolder pe an.
pause
exit /b 0

:eroare
echo.
echo A aparut o eroare. Verifica mesajele de mai sus (conexiune la internet, Python instalat).
pause
exit /b 1
