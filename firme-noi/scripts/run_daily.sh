#!/usr/bin/env bash
# Rulare zilnică automată (Linux/Mac): ia firmele noi direct de la ANAF
# (inclusiv telefonul), verifică telefoanele și exportă Excel-ul pe ani.
# Programează cu cron (vezi crontab.example).
#
#   scripts/run_daily.sh          -> anul curent
#   scripts/run_daily.sh 2020     -> toți anii de la 2020 până azi
set -euo pipefail

# Mergem în folderul proiectului (părintele acestui script)
cd "$(dirname "$0")/.."

# Activează mediul virtual dacă există
if [[ -d ".venv" ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

AN="$(date '+%Y')"
START="${1:-$AN}"
echo "[$(date '+%F %T')] Pornire colectare firme noi ($START–$AN)"
python run.py collect --source anaf_scan --dupa "$START-01-01"
python run.py enrich
python run.py verifica-telefoane
python run.py stats

for an in $(seq "$START" "$AN"); do
  d="export/$an"
  interval=(--dupa "$an-01-01" --inainte "$an-12-31")
  python run.py export --format xlsx --doar-firme "${interval[@]}" --out "$d/Firme-noi-$an.xlsx"
  python run.py export --format xlsx --doar-firme "${interval[@]}" --with-phone --fara-suspecte \
    --fara-comune --out "$d/Firme-noi-$an-cu-telefon.xlsx"
  python run.py export "${interval[@]}" --out "$d/Toate-inregistrarile-$an.csv"
  python run.py stats --an "$an" > "$d/STATISTICI.txt"
done
echo "[$(date '+%F %T')] Gata."
