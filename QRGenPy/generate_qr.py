#!/usr/bin/env python3
"""
Generate a QR code image from text (e.g., a Google Form link).

Usage:
  python generate_qr.py "https://docs.google.com/forms/d/...."
  python generate_qr.py "https://docs.google.com/forms/d/...." --output form_qr.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

import qrcode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a QR code PNG from text or URL."
    )
    parser.add_argument(
        "text",
        help="Text/URL to encode (Google Form link recommended).",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="google_form_qr.png",
        help="Output image filename (default: google_form_qr.png).",
    )
    parser.add_argument(
        "--box-size",
        type=int,
        default=10,
        help="Pixel size of each QR box (default: 10).",
    )
    parser.add_argument(
        "--border",
        type=int,
        default=4,
        help="Border thickness in boxes (default: 4).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    text = args.text.strip()
    if not text:
        raise SystemExit("Input text is empty.")

    if not (text.startswith("http://") or text.startswith("https://")):
        print("Warning: input does not look like a URL. QR will still be generated.")

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=max(1, args.box_size),
        border=max(1, args.border),
    )
    qr.add_data(text)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    output_path = Path(args.output).resolve()
    img.save(output_path)
    print(f"QR generated: {output_path}")


if __name__ == "__main__":
    main()

