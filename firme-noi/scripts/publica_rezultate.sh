#!/usr/bin/env bash
# Publică out/<AN>/ în branch-uri ale repository-ului (privat):
#   anul curent  → „rezultate"        (actualizat la fiecare rulare)
#   anii trecuți → „rezultate-<AN>"   (scriși la finalul colectării acelui an)
# Fiecare branch conține doar ultima versiune a fișierelor (fără istoric).
set -euo pipefail
shopt -s nullglob

cur="$(date -u +%Y)"
for dir in out/*/; do
  an="$(basename "$dir")"
  if [ "$an" = "$cur" ]; then branch="rezultate"; else branch="rezultate-$an"; fi
  tmp="$(mktemp -d)"
  cp "$dir"/*.xlsx "$dir"/STATISTICI.txt "$tmp/"
  gzip -c "$dir/Toate-inregistrarile-$an.csv" > "$tmp/Toate-inregistrarile-$an.csv.gz"
  (
    cd "$tmp"
    git init -q -b "$branch"
    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    git add -A
    git commit -qm "Rezultate $an – $(date -u +%F), rulare ${GITHUB_RUN_ID:-local}"
    git push -qf "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "$branch"
  )
  echo "Publicat $an pe branch-ul $branch."
done
