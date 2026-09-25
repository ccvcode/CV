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

echo "[$(date '+%F %T')] Pornire colectare firme noi"
python run.py run --source onrc
python run.py stats

# Export zilnic doar cu firmele care au telefon
STAMP="$(date '+%Y-%m-%d')"
python run.py export --out "export/firme_${STAMP}.csv" --only-with-phone
echo "[$(date '+%F %T')] Gata."
