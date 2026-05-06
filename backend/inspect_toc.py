"""Diagnostic: inspect TOC text from textbook ZIPs."""
import zipfile, io, re, sys
from pathlib import Path
from PyPDF2 import PdfReader

BASE = Path(__file__).parent / "data" / "textbooks"

def inspect_zip(zip_path: Path, max_pages: int = 8):
    print(f"\n=== {zip_path.relative_to(BASE)} ===")
    try:
        with zipfile.ZipFile(zip_path, "r") as zp:
            pdfs = [f for f in zp.namelist() if f.lower().endswith(".pdf")]
            if not pdfs:
                print("  [no PDFs inside zip]")
                return
            with zp.open(pdfs[0]) as f:
                reader = PdfReader(io.BytesIO(f.read()))
                for i in range(min(max_pages, len(reader.pages))):
                    text = reader.pages[i].extract_text() or ""
                    if text.strip():
                        print(f"  -- page {i} --")
                        print(text[:800])
    except Exception as e:
        print(f"  ERROR: {e}")

subjects = sys.argv[1:] if len(sys.argv) > 1 else ["Biology", "Chemistry", "Accounting", "social studies", "Additional Mathematics"]

for yr_folder in [
    BASE / "ALL SUBJECTS NOTE (YEAR 1)",
    BASE / "ALL SUBJECT NOTE (YEAR 2)" / "ALL SUBJECT NOTE (YEAR 2)",
]:
    print(f"\n\n{'='*60}")
    print(f"YEAR FOLDER: {yr_folder.name}")
    print(f"{'='*60}")
    for subj in subjects:
        for zip_file in sorted(yr_folder.glob("*.zip")):
            if subj.lower() in zip_file.name.lower():
                inspect_zip(zip_file)
                break
