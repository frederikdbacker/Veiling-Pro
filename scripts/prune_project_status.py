#!/usr/bin/env python3
"""Knip oudste sessie-headers uit PROJECT_STATUS.md naar een archief-bestand.

Wordt aangeroepen door .githooks/pre-commit. Loopt stil als
PROJECT_STATUS.md onder de limiet zit.

Heuristiek:
- Een "sessie-header" begint met "## " op een eigen regel.
- We splitsen het hele bestand in: kop-tekst (alles vóór de eerste "## "),
  daarna een lijst van sessie-secties (elk begint met "## " tot de volgende
  "## " of EOF).
- Als het totale bestand > LIMIT_BYTES, verplaatsen we de oudste
  sessie-secties naar het archief tot het bestand weer onder de limiet zit.
- Archief-bestand: PROJECT_STATUS_ARCHIVE_<jaar>.md (jaar = afgeleid uit
  de header-datum als die er staat, anders huidig jaar).

Aanname: nieuwste sessies staan BOVENAAN (jongste eerst, oudste onderaan)
— zoals in de huidige PROJECT_STATUS.md. Oudste secties = laatste in lijst.
"""

from __future__ import annotations
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STATUS_FILE = REPO_ROOT / "PROJECT_STATUS.md"
LIMIT_BYTES = 100_000  # ~100 KB; PROJECT_STATUS van 22-06-2026 zit op ~22 KB

DATE_RE = re.compile(r"\b(20\d{2})[-/]\d{1,2}[-/]\d{1,2}\b")


def main() -> int:
    if not STATUS_FILE.exists():
        return 0

    raw = STATUS_FILE.read_text(encoding="utf-8")
    if len(raw.encode("utf-8")) <= LIMIT_BYTES:
        return 0

    # Split: alles vóór de eerste "## " = preamble; daarna secties.
    parts = re.split(r"(?m)^(?=## )", raw, maxsplit=0)
    if len(parts) < 2:
        return 0  # Geen sessie-headers gevonden, niets te knippen.

    preamble, *sections = parts
    if len(sections) < 2:
        # Eén sessie-sectie? Niet knippen — kan niemand archiveren.
        return 0

    # Oudste secties staan onderaan; we knippen vanaf het einde.
    archived: list[str] = []
    kept: list[str] = list(sections)

    def total_size() -> int:
        return len((preamble + "".join(kept)).encode("utf-8"))

    while kept and total_size() > LIMIT_BYTES and len(kept) > 1:
        archived.insert(0, kept.pop())

    if not archived:
        return 0

    # Archief-bestand: gebruik jaartal uit de eerste gevonden datum, anders huidig.
    year_match = DATE_RE.search(archived[0])
    year = year_match.group(1) if year_match else str(date.today().year)
    archive_path = REPO_ROOT / f"PROJECT_STATUS_ARCHIVE_{year}.md"

    archive_content = ""
    if archive_path.exists():
        archive_content = archive_path.read_text(encoding="utf-8")
        if not archive_content.endswith("\n"):
            archive_content += "\n"

    # Nieuwere geknipt-sessies bovenaan archief (consistent met PROJECT_STATUS-volgorde).
    new_archive_block = "".join(archived)
    archive_path.write_text(new_archive_block + archive_content, encoding="utf-8")

    new_status = preamble + "".join(kept)
    if not new_status.endswith("\n"):
        new_status += "\n"
    STATUS_FILE.write_text(new_status, encoding="utf-8")

    # Stage beide bestanden bij de lopende commit.
    subprocess.run(["git", "add", str(STATUS_FILE), str(archive_path)], check=False)

    print(
        f"[prune_project_status] {len(archived)} sectie(s) verplaatst naar "
        f"{archive_path.name}; PROJECT_STATUS.md nu {len(new_status.encode('utf-8'))} bytes."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
