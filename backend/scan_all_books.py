"""Scan every textbook ZIP in Year 1 and Year 2 dirs, extract TOC, cache results."""
import zipfile, io, re, json, sys
from pathlib import Path
from PyPDF2 import PdfReader

BASE   = Path(__file__).parent / "data" / "textbooks"
CACHE  = Path(__file__).parent / "data" / "intelligence_cache"

Y1_DIR  = BASE / "ALL SUBJECTS NOTE (YEAR 1)"
Y2_DIRS = [
    BASE / "ALL SUBJECT NOTE (YEAR 2)" / "ALL SUBJECT NOTE (YEAR 2)",
    BASE / "ALL SUBJECT NOTE (YEAR 2)",
]

FFFD = "�"  # replacement char used as dot leader in many GES PDFs

def proper_title(s: str) -> str:
    """Title-case without capitalising after apostrophe (Earth's not Earth'S)."""
    return re.sub(r"'([A-Z])", lambda m: "'" + m.group(1).lower(), s.title())

# ── TOC cleaning ─────────────────────────────────────────────────────────────

def clean_toc_line(raw: str) -> str:
    # Normalise curly/smart apostrophes
    line = raw.replace("’", "'").replace("‘", "'")
    # Strip leading lowercase roman numeral glued to an uppercase word: ivTABLE, vSECTION
    line = re.sub(r"^[ivxl]{1,6}(?=[A-Z])", "", line)
    # Strip standalone leading roman numeral with whitespace
    line = re.sub(r"^\s*[ivxl]{1,6}\s+", "", line)
    # Horizontal ellipsis leaders  … … … 3
    line = re.sub(r"…+", " ", line)
    # U+FFFD replacement-char dot leaders  ??? ??? ??? 3
    line = re.sub(r"(�[\s�]*)+", " ", line)
    # Spaced-dot leaders  . . . . 3
    line = re.sub(r"(\s*\.\s*){2,}", " ", line)
    # Dense dot / dash leaders  .....  -----
    line = re.sub(r"[.\-_~]{3,}", " ", line)
    # Collapse whitespace
    line = re.sub(r"\s+", " ", line).strip()
    # Strip trailing page number (optional roman prefix + arabic digits)
    line = re.sub(r"\s+[ivxlIVXL]{0,4}\d{1,4}$", "", line).strip()
    # Strip trailing standalone roman numeral
    line = re.sub(r"\s+[ivxlIVXL]{1,6}$", "", line).strip()
    return line

# ── TOC parsing ───────────────────────────────────────────────────────────────

SKIP_RE = re.compile(
    r"\b(FOREWORD|PREFACE|ACKNOWLEDGEMENTS?|ACKNOWLEDGMENTS?|ACKNOWLEDGMENTS?"
    r"|TABLE\s+OF\s+CONTENTS|INDEX|COPYRIGHT|MINISTRY|ASSOCIATION"
    r"|ISBN|REPUBLIC|REVIEW\s+QUESTIONS?|REFERENCES?|BIBLIOGRAPHY|BIBLIOGRAPHIES"
    r"|GLOSSARY|APPENDIX|ANNEXURE)\b",
    re.I,
)

def parse_toc(full_text: str) -> list:
    # Prefer a standalone TOC heading line: optional page-number prefix then CONTENTS
    toc_match = re.search(
        r"(?:^|\n)[^\S\n]{0,4}[ivxl\d]{0,8}[^\S\n]{0,2}"
        r"(?:TABLE\s+OF\s+)?CONTENTS[^\S\n]*\n",
        full_text, re.I,
    )
    if not toc_match:
        toc_match = re.search(r"CONTENTS", full_text, re.I)
    toc_text = full_text[toc_match.start():] if toc_match else full_text

    # Truncate at the actual FOREWORD prose (not the TOC entry for FOREWORD)
    fw_prose = re.search(
        r"[ivxl\d]{0,8}FOREWORD\s*\n\s*[A-Z][a-z].{60}", toc_text
    )
    if fw_prose:
        toc_text = toc_text[: fw_prose.start()]

    topics: list = []
    seen: set = set()

    for raw_line in toc_text.split("\n"):
        line = clean_toc_line(raw_line)
        if not line or len(line) < 4:
            continue
        if line.upper() == "CONTENTS":
            continue
        if SKIP_RE.search(line):
            continue
        if re.match(r"^[\d\s]+$", line):
            continue
        if len(line) > 160:
            continue

        # Priority 1 — SECTION / UNIT / CHAPTER / TOPIC N: title
        m = re.match(r"^(?:SECTION|UNIT|CHAPTER|TOPIC)\s+\d+[:.)]?\s*(.+)", line, re.I)
        if m:
            topic = proper_title(re.sub(r"\s+", " ", m.group(1)).strip())
            if len(topic) >= 4 and topic not in seen:
                topics.append(topic)
                seen.add(topic)
            continue

        # Priority 2 — ALL-CAPS heading ≤ 120 chars (allow smart apostrophe U+2019)
        if re.match(r"^[A-Z][A-Z0-9\s,&/()\’’\-]{5,}$", line) and len(line) <= 120:
            topic = proper_title(line)
            if len(topic) >= 5 and topic not in seen:
                topics.append(topic)
                seen.add(topic)
            continue

        # Priority 3 — Title/sentence case heading ≤ 100 chars
        if re.match(r"^[A-Z][a-zA-Z0-9\s,&/()\'’\-]{7,}$", line) and len(line) <= 100:
            topic = line.strip()
            if len(topic) >= 6 and topic not in seen:
                topics.append(topic)
                seen.add(topic)

    return topics


# ── PDF extraction ────────────────────────────────────────────────────────────

def extract_text(zip_path: Path, max_pages: int = 20) -> str:
    try:
        with zipfile.ZipFile(zip_path, "r") as zp:
            pdfs = sorted(f for f in zp.namelist() if f.lower().endswith(".pdf"))
            if not pdfs:
                return ""
            with zp.open(pdfs[0]) as f:
                reader = PdfReader(io.BytesIO(f.read()))
                text = ""
                for i in range(min(max_pages, len(reader.pages))):
                    try:
                        text += reader.pages[i].extract_text() or ""
                    except Exception:
                        continue
                return text
    except Exception as e:
        return f"ERROR: {e}"


# ── Slug normalisation ────────────────────────────────────────────────────────

def to_slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return s


# ── Main scan ─────────────────────────────────────────────────────────────────

VERBOSE     = "--verbose" in sys.argv or "-v" in sys.argv
DUMP_FAILED = "--dump"    in sys.argv

results = {}

def scan_dir(year_key: str, directory: Path, already_seen: set):
    if not directory.exists():
        return
    for zip_path in sorted(directory.glob("*.zip")):
        name = zip_path.stem
        slug = to_slug(name)
        key  = (year_key, slug)
        if key in already_seen:
            continue
        already_seen.add(key)

        text = extract_text(zip_path)
        if text.startswith("ERROR"):
            results[key] = {"name": name, "slug": slug, "year": year_key, "topics": [], "error": text}
            print(f"  [ERROR] {year_key}/{name}: {text}")
            continue

        topics = parse_toc(text)
        results[key] = {"name": name, "slug": slug, "year": year_key, "topics": topics}

        status = f"  {'OK  ' if topics else 'FAIL'} {year_key}/{name}: {len(topics)} topics"
        print(status)
        if topics and VERBOSE:
            for t in topics[:6]:
                print(f"       - {t}")
            if len(topics) > 6:
                print(f"       ... (+{len(topics)-6} more)")
        if DUMP_FAILED and not topics:
            m = re.search(r"CONTENTS", text, re.I)
            snippet = text[m.start(): m.start() + 2000] if m else text[:2000]
            print(f"\n--- RAW ({zip_path.name}) ---")
            sys.stdout.buffer.write(snippet.encode("utf-8", errors="replace"))
            print("\n--- END ---\n")


print("\n=== YEAR 1 ===")
seen1: set = set()
scan_dir("year_1", Y1_DIR, seen1)

print("\n=== YEAR 2 ===")
seen2: set = set()
for d in Y2_DIRS:
    scan_dir("year_2", d, seen2)

# ── Summary ───────────────────────────────────────────────────────────────────

ok   = [v for v in results.values() if v["topics"]]
fail = [v for v in results.values() if not v["topics"]]

print(f"\n{'='*60}")
print(f"TOTAL: {len(results)}  OK: {len(ok)}  FAILED: {len(fail)}")
if fail:
    print("\nFAILED:")
    for v in fail:
        print(f"  {v['year']}/{v['name']}")

# ── Cache ─────────────────────────────────────────────────────────────────────

CACHE.mkdir(parents=True, exist_ok=True)
saved = 0
for v in ok:
    cache_file = CACHE / f"topics_{v['year']}_{v['slug']}.json"
    cache_file.write_text(json.dumps(sorted(set(v["topics"]))), encoding="utf-8")
    saved += 1

print(f"\nSaved {saved} topic caches to {CACHE}")
