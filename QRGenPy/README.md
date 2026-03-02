# QRGenPy

Generate a QR code image from text or URL (including Google Form links).

## Setup

```bash
pip install -r requirements.txt
```

## Usage

```bash
python generate_qr.py "https://docs.google.com/forms/d/e/XXXXX/viewform"
```

With custom output filename:

```bash
python generate_qr.py "https://docs.google.com/forms/d/e/XXXXX/viewform" --output my_form_qr.png
```

