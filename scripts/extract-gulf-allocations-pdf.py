#!/usr/bin/env python3
"""Extract text from AllocationsGulfTelecom.pdf into dashboard/data/gulf-telecom-allocations.txt"""
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    print("Install: pip install pypdf", file=sys.stderr)
    sys.exit(1)

def main():
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if pdf is None:
        here = Path(__file__).resolve().parent
        for cand in (here.parent / "uploads" / "AllocationsGulfTelecom.pdf", here.parent / "dashboard" / "data" / "gulf-telecom-allocations.pdf"):
            if cand.is_file():
                pdf = cand
                break
        if pdf is None:
            print("Usage: extract-gulf-allocations-pdf.py <AllocationsGulfTelecom.pdf>", file=sys.stderr)
            sys.exit(1)
    out = Path(__file__).resolve().parents[1] / "dashboard" / "data" / "gulf-telecom-allocations.txt"
    if not pdf.is_file():
        print(f"PDF not found: {pdf}", file=sys.stderr)
        sys.exit(1)
    r = PdfReader(str(pdf))
    text = "\n".join((p.extract_text() or "") for p in r.pages)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(f"Wrote {len(text)} chars to {out}")

if __name__ == "__main__":
    main()
