#!/usr/bin/env bash
# Exportă rezultatele pe ani, în out/<AN>/:
#   Firme-noi-<AN>.xlsx               – firme noi active
#   Firme-noi-<AN>-cu-telefon.xlsx    – firme noi active cu telefon valid
#   Toate-inregistrarile-<AN>.csv     – toate înregistrările (inclusiv sedii secundare, PFA)
#   STATISTICI.txt
#
# Anii exportați: de la anul lui $DUPA până la anul curent, plus anul trecut
# o singură dată (dacă nu are încă branch-ul „rezultate-<AN>"), ca la schimbarea
# anului fișierele anului încheiat să fie arhivate.
set -euo pipefail

cur="$(date -u +%Y)"
start="${DUPA:0:4}"
ani="$(seq "$start" "$cur")"
prev=$((cur - 1))
if [ "$start" -gt "$prev" ] && ! git ls-remote --exit-code --heads origin "rezultate-$prev" >/dev/null 2>&1; then
  ani="$prev $ani"
fi

mkdir -p out
for an in $ani; do
  d="out/$an"
  mkdir -p "$d"
  interval=(--dupa "$an-01-01" --inainte "$an-12-31")
  python run.py export "${interval[@]}" --out "$d/Toate-inregistrarile-$an.csv"
  if [ "$(wc -l < "$d/Toate-inregistrarile-$an.csv")" -le 1 ]; then
    echo "Nicio înregistrare pentru $an; sar peste."
    rm -rf "$d"
    continue
  fi
  python run.py export --format xlsx --doar-firme "${interval[@]}" --out "$d/Firme-noi-$an.xlsx"
  python run.py export --format xlsx --doar-firme "${interval[@]}" --with-phone --fara-suspecte \
    --out "$d/Firme-noi-$an-cu-telefon.xlsx"
  python run.py stats --an "$an" > "$d/STATISTICI.txt"
  head -7 "$d/STATISTICI.txt"
done
