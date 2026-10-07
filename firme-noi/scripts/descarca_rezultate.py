#!/usr/bin/env python3
"""Descarcă rezultatele publicate pe GitHub în folderul `rezultate/<AN>/`.

Rezultatele stau în branch-urile `rezultate` (anul curent) și `rezultate-AN`
ale repository-ului privat ccvcode/web-development. Rulează scriptul din clona
acelui repository (Windows, Mac sau Linux):

    python scripts/descarca_rezultate.py
    python run.py restore rezultate          # reface baza de date locală

Folderul `rezultate/` e exclus din git (conține date de contact).
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_YEAR_RE = re.compile(r"-(\d{4})(?:-|\.)")


def git(*args: str) -> bytes:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True).stdout


def main() -> None:
    try:
        git("fetch", "--quiet", "origin",
            "+refs/heads/rezultate*:refs/remotes/origin/rezultate*")
    except subprocess.CalledProcessError as exc:
        sys.exit("Nu am putut descărca branch-urile cu rezultate (ești în clona "
                 "repository-ului web-development și ai acces la el?)\n"
                 + exc.stderr.decode(errors="replace"))
    branches = git("for-each-ref", "--format=%(refname)",
                   "refs/remotes/origin/rezultate*").decode().split()
    if not branches:
        sys.exit("Nu există branch-uri „rezultate*” pe GitHub.")
    for ref in sorted(branches):
        files = git("ls-tree", "--name-only", ref).decode().splitlines()
        years = {m.group(1) for f in files if (m := _YEAR_RE.search(f))}
        year = years.pop() if len(years) == 1 else ref.rsplit("/", 1)[-1]
        dest = ROOT / "rezultate" / year
        dest.mkdir(parents=True, exist_ok=True)
        for name in files:
            (dest / name).write_bytes(git("show", f"{ref}:{name}"))
        print(f"{year}: {len(files)} fișiere în {dest.relative_to(ROOT)}")
    print("\nGata. Pasul următor: python run.py restore rezultate")


if __name__ == "__main__":
    main()
