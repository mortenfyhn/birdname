#!/usr/bin/env python3
"""Build the browser dataset from IOC 15.2 names and the European checklist."""
import json
import unicodedata
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MULTI = DATA / "Multiling IOC 15.2.xlsx"
EUROPE = DATA / "europe-species.txt"
OVERRIDES = DATA / "norwegian-overrides.json"
OUT = DATA / "birds.json"

# (UI code, IOC column, UI label, short label). Sorted alphabetically for the
# picker; the scientific name is shown above these and added by the app.
LANGUAGES = sorted([
    ("no", "Norwegian", "Norsk", "NO"),
    ("fr", "French", "Français", "FR"),
    ("en", "English", "English", "EN"),
    ("ca", "Catalan", "Català", "CA"),
    ("hr", "Croatian", "Hrvatski", "HR"),
    ("cs", "Czech", "Čeština", "CS"),
    ("da", "Danish", "Dansk", "DA"),
    ("nl", "Dutch", "Nederlands", "NL"),
    ("eo", "Esperanto", "Esperanto", "EO"),
    ("fi", "Finnish", "Suomi", "FI"),
    ("de", "German", "Deutsch", "DE"),
    ("el", "Greek", "Ελληνικά", "EL"),
    ("hu", "Hungarian", "Magyar", "HU"),
    ("is", "Icelandic", "Íslenska", "IS"),
    ("it", "Italian", "Italiano", "IT"),
    ("lv", "Latvian", "Latviešu", "LV"),
    ("lt", "Lithuanian", "Lietuvių", "LT"),
    ("mk", "Macedonian", "Македонски", "MK"),
    ("se", "Northern Sami", "Davvisámegiella", "SE"),
    ("pl", "Polish", "Polski", "PL"),
    ("pt", "Portuguese (Portuguese)", "Português", "PT"),
    ("ro", "Romanian", "Română", "RO"),
    ("ru", "Russian", "Русский", "RU"),
    ("sr", "Serbian", "Српски", "SR"),
    ("sk", "Slovak", "Slovenčina", "SK"),
    ("sl", "Slovenian", "Slovenščina", "SL"),
    ("es", "Spanish", "Español", "ES"),
    ("sv", "Swedish", "Svenska", "SV"),
    ("tr", "Turkish", "Türkçe", "TR"),
    ("uk", "Ukrainian", "Українська", "UK"),
    ("et", "Estonian", "Eesti", "ET"),
    ("bg", "Bulgarian", "Български", "BG"),
    ("be", "Belarusian", "Беларуская", "BE"),
], key=lambda language: unicodedata.normalize("NFD", language[2].lower()))

# The European checklist follows AviList taxonomy. Map its two name differences
# to the equivalent IOC 15.2 accepted species.
CHECKLIST_ALIASES = {
    "Helopsaltes fasciolata": "Helopsaltes fasciolatus",
    "Phoenicopterus minor": "Phoeniconaias minor",
    "Phyloscopus plumbeitarsus": "Phylloscopus plumbeitarsus",
}

def build():
    if not MULTI.exists() or not EUROPE.exists() or not OVERRIDES.exists():
        raise SystemExit("Missing data source files; see data/README.md.")

    norwegian_overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    checklist = {
        CHECKLIST_ALIASES.get(line.strip(), line.strip())
        for line in EUROPE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    wb = load_workbook(MULTI, read_only=True, data_only=True)
    ws = wb["List"]
    rows = ws.iter_rows(values_only=True)
    headers = next(rows)
    columns = {name: headers.index(name) for _, name, _, _ in LANGUAGES}
    sci_col = headers.index("IOC_15.2")
    birds = []
    found = set()
    for row in rows:
        scientific = str(row[sci_col]).strip() if row[sci_col] else ""
        if scientific not in checklist:
            continue
        names = {
            code: str(row[columns[column]]).strip()
            for code, column, _, _ in LANGUAGES
            if row[columns[column]] and str(row[columns[column]]).strip()
        }
        if scientific in norwegian_overrides:
            names["no"] = norwegian_overrides[scientific]
        birds.append({"scientific": scientific, "names": names})
        found.add(scientific)
    wb.close()
    birds.sort(key=lambda bird: bird["scientific"].casefold())

    required = {
        "Anas platyrhynchos", "Ciconia ciconia", "Columba palumbus",
        "Cyanistes caeruleus", "Erithacus rubecula", "Fringilla coelebs",
        "Helopsaltes fasciolatus", "Melanitta deglandi", "Melanitta stejnegeri",
        "Parus major", "Passer domesticus", "Phylloscopus collybita",
        "Sturnus vulgaris", "Turdus merula",
    }
    missing = required - found
    if missing:
        raise SystemExit(f"European checklist is missing expected birds: {sorted(missing)}")

    DATA.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({
        "source": "IOC World Bird List 15.2 multilingual names; European bird checklist",
        "languages": [
            {"code": code, "label": label, "short": short}
            for code, _, label, short in LANGUAGES
        ],
        "birds": birds,
    }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(birds)} birds from Europe checklist ({len(checklist)} entries).")
    print(f"Checklist names without an IOC 15.2 match: {len(checklist - found)}")
    print("Language coverage:")
    for code, _, label, _ in LANGUAGES:
        count = sum(bool(bird["names"].get(code)) for bird in birds)
        print(f"  {label}: {count}/{len(birds)}")


if __name__ == "__main__":
    build()
