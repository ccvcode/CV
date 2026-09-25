#!/usr/bin/env bash
# Rulare zilnică automată: colectează firme noi din ONRC, le îmbogățește cu
# date ANAF și caută telefoane. Programează cu cron (vezi crontab.example).
set -euo pipefail

# Mergem în folderul proiectului (părintele acestui script)
cd "$(dirname "$0")/.."

# Activează mediul virtual dacă există
if [[ -d ".venv" ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

AN="$(date '+%Y')"
echo "[$(date '+%F %T')] Pornire colectare firme noi ($AN)"
python run.py run --source onrc --an "$AN"
python run.py stats

# Export: toate firmele din an + doar cele cu telefon valid
python run.py export --format xlsx --dupa "$AN-01-01" --out "export/Firme-noi-$AN.xlsx"
python run.py export --format xlsx --dupa "$AN-01-01" --with-phone --fara-suspecte \
  --out "export/Firme-noi-$AN-cu-telefon.xlsx"
echo "[$(date '+%F %T')] Gata."
