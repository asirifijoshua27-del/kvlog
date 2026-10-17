"""Re-run OCR on the scanned Twi Bible, one column at a time.

Install once:
  1. Tesseract for Windows: https://github.com/UB-Mannheim/tesseract/wiki  (tick "Add to PATH")
  2. pip install pymupdf pytesseract pillow numpy

Run:
  python tools/ocr_twi.py "C:\\path\\to\\Twi-Asante-Bible.pdf" twi_bible_columns.txt

It writes each page as [HEADER], [LEFT] and [RIGHT] blocks so the two columns are never mixed.
Takes about 1-2 hours for 1,050 pages. It can be stopped and restarted: finished pages are kept.
"""
import io, os, sys
import fitz  # pymupdf
import numpy as np
import pytesseract
from PIL import Image, ImageOps

DPI = 300
HEADER_SHARE = 0.065   # top part of each page holding the running heading
CONFIG = "--oem 1 --psm 6 -c preserve_interword_spaces=1"


def gutter(gray: np.ndarray) -> int:
    """Find the white gap between the two columns near the middle of the page."""
    w = gray.shape[1]
    lo, hi = int(w * 0.40), int(w * 0.60)
    ink = (gray[:, lo:hi] < 140).sum(axis=0)
    ink = np.convolve(ink, np.ones(15) / 15, mode="same")
    return lo + int(ink.argmin())


def ocr(img: Image.Image) -> str:
    return pytesseract.image_to_string(img, lang="eng", config=CONFIG).strip()


def main(pdf_path: str, out_path: str) -> None:
    done = set()
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as f:
            for line in f:
                if line.startswith("===== PAGE "):
                    done.add(int(line.split()[2]))
    doc = fitz.open(pdf_path)
    with open(out_path, "a", encoding="utf-8") as out:
        for i, page in enumerate(doc, start=1):
            if i in done:
                continue
            pix = page.get_pixmap(dpi=DPI, colorspace=fitz.csGRAY)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
            img = ImageOps.autocontrast(img)
            gray = np.array(img)
            h, w = gray.shape
            top = int(h * HEADER_SHARE)
            mid = gutter(gray[top:])
            header = ocr(img.crop((0, 0, w, top)))
            left = ocr(img.crop((0, top, mid, h)))
            right = ocr(img.crop((mid, top, w, h)))
            out.write(f"===== PAGE {i} =====\n[HEADER]\n{header}\n[LEFT]\n{left}\n[RIGHT]\n{right}\n")
            out.flush()
            print(f"page {i}/{len(doc)}", flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python tools/ocr_twi.py <bible.pdf> <output.txt>")
    main(sys.argv[1], sys.argv[2])
