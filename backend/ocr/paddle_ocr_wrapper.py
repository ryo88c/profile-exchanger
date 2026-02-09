#!/usr/bin/env python3
"""
Simple OCR wrapper for PaddleOCR.
Reads an image path and prints OCR text to stdout.
"""

from __future__ import annotations

import argparse
import sys
from typing import List


def flatten_text(result: list) -> str:
    texts: List[str] = []
    # PaddleOCR output shape can vary by version; handle common formats.
    for item in result:
        if not item:
            continue
        if isinstance(item, dict):
            rec_texts = item.get("rec_texts")
            if isinstance(rec_texts, list):
                texts.extend(str(x) for x in rec_texts if x)
            continue
        if isinstance(item, list):
            for line in item:
                if (
                    isinstance(line, list)
                    and len(line) >= 2
                    and isinstance(line[1], (list, tuple))
                    and len(line[1]) >= 1
                ):
                    t = line[1][0]
                    if t:
                        texts.append(str(t))
    return "\n".join(texts).strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_path", help="Path to input image")
    parser.add_argument(
      "--lang",
      default="en",
      help="PaddleOCR language code (default: en)",
    )
    args = parser.parse_args()

    try:
        from paddleocr import PaddleOCR
    except Exception as exc:  # pragma: no cover
        print(f"Failed to import paddleocr: {exc}", file=sys.stderr)
        return 2

    try:
        ocr = PaddleOCR(use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False, lang=args.lang)
        result = ocr.ocr(args.input_path)
        text = flatten_text(result)
        if text:
            print(text)
        return 0
    except Exception as exc:  # pragma: no cover
        print(f"PaddleOCR failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
