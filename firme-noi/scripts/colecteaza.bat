@echo off
REM Colectare firme noi din anul curent + telefoane ANAF, export Excel (Windows).
REM Necesita Python 3.10+ instalat (https://www.python.org/downloads/).
REM Prima rulare dureaza ~30-40 minute (ANAF accepta 1 cerere pe secunda).

cd /d "%~dp0\.."
python -m pip install -r requirements.txt || goto :eroare

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy"') do set AN=%%i

python run.py probe || goto :eroare
python run.py collect --source onrc --an %AN% || goto :eroare
python run.py enrich || goto :eroare
python run.py stats
python run.py export --format xlsx --dupa %AN%-01-01 --out export\Firme-noi-%AN%.xlsx
python run.py export --format xlsx --dupa %AN%-01-01 --with-phone --fara-suspecte --out export\Firme-noi-%AN%-cu-telefon.xlsx

echo.
echo Gata. Fisierele Excel sunt in folderul "export".
pause
exit /b 0

:eroare
echo.
echo A aparut o eroare. Verifica mesajele de mai sus (conexiune la internet, Python instalat).
pause
exit /b 1
