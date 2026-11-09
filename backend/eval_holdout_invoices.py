import os
import sys
import io
import time
import re
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from decimal import Decimal

# Add backend to path
sys.path.append(os.path.dirname(__file__))

# Configure environment for testing
os.environ["TESTING"] = "True"

from app.api.routes.import_data import configure_ocr_engine, perform_ocr_sync, purchase_ocr
from fastapi import UploadFile

configure_ocr_engine()

def get_font(size: int = 24, bold: bool = False):
    try:
        font_name = "arialbd.ttf" if bold else "arial.ttf"
        return ImageFont.truetype(font_name, size)
    except Exception:
        return ImageFont.load_default()

# ---------------------------------------------------------------------------
# Independent Holdout Test Invoice Generators (Unseen during tuning)
# ---------------------------------------------------------------------------

def generate_holdout_mouser_pdf():
    """
    Holdout 1: Mouser Electronics India (Multi-page PDF Invoice).
    2-page PDF structure with multiple components and IGST.
    """
    # Page 1
    p1 = Image.new('L', (2200, 1700), color=255)
    d1 = ImageDraw.Draw(p1)
    f_title, f_bold, f_text, f_sm = get_font(36, True), get_font(26, True), get_font(24), get_font(20)

    d1.text((100, 80), 'TAX INVOICE - INTERSTATE', fill=0, font=f_title)
    d1.text((100, 140), 'Supplier: Mouser Electronics India Pvt Ltd', fill=0, font=f_bold)
    d1.text((100, 185), 'GSTIN: 29AAACM2219P1ZU', fill=0, font=f_bold)
    d1.text((100, 230), 'Invoice Number: MSR-IN-2026-904', fill=0, font=f_bold)
    d1.text((100, 275), 'Date: 14/06/2026', fill=0, font=f_text)
    d1.text((100, 320), 'Page: 1 of 2', fill=0, font=f_sm)

    d1.line([(100, 370), (2100, 370)], fill=0, width=3)
    d1.text((100, 385), 'Item Description', fill=0, font=f_bold)
    d1.text((1150, 385), 'HSN', fill=0, font=f_bold)
    d1.text((1350, 385), 'Qty', fill=0, font=f_bold)
    d1.text((1550, 385), 'Rate', fill=0, font=f_bold)
    d1.text((1850, 385), 'Amount', fill=0, font=f_bold)
    d1.line([(100, 435), (2100, 435)], fill=0, width=2)

    d1.text((100, 465), 'ESP32-WROOM-32E Wi-Fi + BLE Module', fill=0, font=f_text)
    d1.text((1150, 465), '85423100', fill=0, font=f_text)
    d1.text((1350, 465), '10', fill=0, font=f_text)
    d1.text((1550, 465), '280.00', fill=0, font=f_text)
    d1.text((1850, 465), '2800.00', fill=0, font=f_text)

    d1.text((100, 525), 'AMS1117-3.3 SOT-223 Voltage Regulator', fill=0, font=f_text)
    d1.text((1150, 525), '85423900', fill=0, font=f_text)
    d1.text((1350, 525), '50', fill=0, font=f_text)
    d1.text((1550, 525), '8.50', fill=0, font=f_text)
    d1.text((1850, 525), '425.00', fill=0, font=f_text)

    # Page 2
    p2 = Image.new('L', (2200, 1700), color=255)
    d2 = ImageDraw.Draw(p2)
    d2.text((100, 80), 'TAX INVOICE - INTERSTATE (Continued)', fill=0, font=f_title)
    d2.text((100, 140), 'Invoice Number: MSR-IN-2026-904', fill=0, font=f_bold)
    d2.text((100, 185), 'Page: 2 of 2', fill=0, font=f_sm)

    d2.line([(100, 235), (2100, 235)], fill=0, width=3)
    d2.text((100, 250), 'Item Description', fill=0, font=f_bold)
    d2.text((1150, 250), 'HSN', fill=0, font=f_bold)
    d2.text((1350, 250), 'Qty', fill=0, font=f_bold)
    d2.text((1550, 250), 'Rate', fill=0, font=f_bold)
    d2.text((1850, 250), 'Amount', fill=0, font=f_bold)
    d2.line([(100, 300), (2100, 300)], fill=0, width=2)

    d2.text((100, 330), 'CH340G USB to UART Bridge SOP-16', fill=0, font=f_text)
    d2.text((1150, 330), '85423100', fill=0, font=f_text)
    d2.text((1350, 330), '20', fill=0, font=f_text)
    d2.text((1550, 330), '35.00', fill=0, font=f_text)
    d2.text((1850, 330), '700.00', fill=0, font=f_text)
    d2.line([(100, 390), (2100, 390)], fill=0, width=2)

    d2.text((1400, 430), 'Subtotal:', fill=0, font=f_bold)
    d2.text((1850, 430), '3925.00', fill=0, font=f_text)
    d2.text((1400, 475), 'IGST 18%:', fill=0, font=f_text)
    d2.text((1850, 475), '706.50', fill=0, font=f_text)
    d2.text((1400, 520), 'Round Off:', fill=0, font=f_text)
    d2.text((1850, 520), '0.50', fill=0, font=f_text)
    d2.line([(1400, 560), (2100, 560)], fill=0, width=3)
    d2.text((1400, 585), 'Grand Total:', fill=0, font=f_title)
    d2.text((1850, 585), '4632.00', fill=0, font=f_title)

    # Save as 2-page PDF
    buf = io.BytesIO()
    p1.save(buf, format='PDF', save_all=True, append_images=[p2], resolution=300)
    return buf.getvalue(), "holdout_mouser.pdf"

def generate_holdout_digikey_invoice():
    """
    Holdout 2: Digi-Key / Semikart India clean A4 invoice.
    Date format: YYYY-MM-DD, CGST + SGST.
    """
    img = Image.new('L', (2200, 1600), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(36, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Semikart India Private Limited', fill=0, font=f_bold)
    draw.text((100, 185), 'GSTIN: 29AAGCS8811K1Z2', fill=0, font=f_bold)
    draw.text((100, 230), 'Invoice No: SK-2026-551', fill=0, font=f_bold)
    draw.text((100, 275), 'Date: 2026-07-19', fill=0, font=f_text)

    draw.line([(100, 340), (2100, 340)], fill=0, width=3)
    draw.text((100, 360), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 360), 'HSN', fill=0, font=f_bold)
    draw.text((1350, 360), 'Qty', fill=0, font=f_bold)
    draw.text((1550, 360), 'Rate', fill=0, font=f_bold)
    draw.text((1850, 360), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 410), (2100, 410)], fill=0, width=2)

    draw.text((100, 440), 'ATmega328P-PU Microcontroller DIP-28', fill=0, font=f_text)
    draw.text((1150, 440), '85423100', fill=0, font=f_text)
    draw.text((1350, 440), '5', fill=0, font=f_text)
    draw.text((1550, 440), '210.00', fill=0, font=f_text)
    draw.text((1850, 440), '1050.00', fill=0, font=f_text)

    draw.text((100, 500), 'ATTINY85-20PU 8-bit AVR DIP-8', fill=0, font=f_text)
    draw.text((1150, 500), '85423100', fill=0, font=f_text)
    draw.text((1350, 500), '10', fill=0, font=f_text)
    draw.text((1550, 500), '145.00', fill=0, font=f_text)
    draw.text((1850, 500), '1450.00', fill=0, font=f_text)
    draw.line([(100, 560), (2100, 560)], fill=0, width=2)

    draw.text((1400, 600), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1850, 600), '2500.00', fill=0, font=f_text)
    draw.text((1400, 645), 'CGST 9%:', fill=0, font=f_text)
    draw.text((1850, 645), '225.00', fill=0, font=f_text)
    draw.text((1400, 690), 'SGST 9%:', fill=0, font=f_text)
    draw.text((1850, 690), '225.00', fill=0, font=f_text)
    draw.line([(1400, 735), (2100, 735)], fill=0, width=3)
    draw.text((1400, 760), 'Grand Total:', fill=0, font=f_title)
    draw.text((1850, 760), '2950.00', fill=0, font=f_title)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue(), "holdout_digikey.png"

def generate_holdout_thermal_receipt():
    """
    Holdout 3: SP Road Local Hardware Vendor (Thermal Receipt / Cash Memo).
    Narrow slip format, unregistered vendor (no GSTIN).
    """
    img = Image.new('L', (1200, 1500), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(32, True), get_font(24, True), get_font(22)

    draw.text((60, 60), 'ESTIMATE / CASH MEMO', fill=0, font=f_title)
    draw.text((60, 115), 'Supplier: SP Road Components Centre', fill=0, font=f_bold)
    # NO GSTIN - Non-GST vendor
    draw.text((60, 160), 'Bill No: SPR-8812', fill=0, font=f_bold)
    draw.text((60, 205), 'Date: 05/08/2026', fill=0, font=f_text)

    draw.line([(60, 260), (1140, 260)], fill=0, width=2)
    draw.text((60, 280), 'Description', fill=0, font=f_bold)
    draw.text((700, 280), 'Qty', fill=0, font=f_bold)
    draw.text((850, 280), 'Rate', fill=0, font=f_bold)
    draw.text((1000, 280), 'Total', fill=0, font=f_bold)
    draw.line([(60, 325), (1140, 325)], fill=0, width=2)

    draw.text((60, 355), 'Solder Wire 60/40 50g Reel', fill=0, font=f_text)
    draw.text((700, 355), '2', fill=0, font=f_text)
    draw.text((850, 355), '180.00', fill=0, font=f_text)
    draw.text((1000, 355), '360.00', fill=0, font=f_text)

    draw.text((60, 415), 'Heat Shrink Tube 3mm 5m Pack', fill=0, font=f_text)
    draw.text((700, 415), '3', fill=0, font=f_text)
    draw.text((850, 415), '60.00', fill=0, font=f_text)
    draw.text((1000, 415), '180.00', fill=0, font=f_text)
    draw.line([(60, 475), (1140, 475)], fill=0, width=2)

    draw.text((650, 515), 'Grand Total:', fill=0, font=f_title)
    draw.text((1000, 515), '540.00', fill=0, font=f_title)

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=92)
    return buf.getvalue(), "holdout_thermal.jpg"

def generate_holdout_mobile_photo():
    """
    Holdout 4: Mobile phone camera capture with gradient lighting and blur.
    Supplier: Silverline Electronics, GSTIN present.
    """
    img = Image.new('L', (2000, 1400), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(36, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Silverline Electronics & Automation', fill=0, font=f_bold)
    draw.text((100, 185), 'GSTIN: 36AAIFS9900L1ZQ', fill=0, font=f_bold)
    draw.text((100, 230), 'Invoice No: SLE-2026-102', fill=0, font=f_bold)
    draw.text((100, 275), 'Date: 30/09/2026', fill=0, font=f_text)

    draw.line([(100, 340), (1900, 340)], fill=0, width=3)
    draw.text((100, 360), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 360), 'HSN', fill=0, font=f_bold)
    draw.text((1350, 360), 'Qty', fill=0, font=f_bold)
    draw.text((1500, 360), 'Rate', fill=0, font=f_bold)
    draw.text((1700, 360), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 410), (1900, 410)], fill=0, width=2)

    draw.text((100, 440), 'BME280 Temperature Humidity Sensor Module', fill=0, font=f_text)
    draw.text((1150, 440), '90258000', fill=0, font=f_text)
    draw.text((1350, 440), '4', fill=0, font=f_text)
    draw.text((1500, 440), '320.00', fill=0, font=f_text)
    draw.text((1700, 440), '1280.00', fill=0, font=f_text)

    draw.text((100, 500), 'MPU6050 6-Axis Gyro Accelerometer Module', fill=0, font=f_text)
    draw.text((1150, 500), '90318000', fill=0, font=f_text)
    draw.text((1350, 500), '6', fill=0, font=f_text)
    draw.text((1500, 500), '150.00', fill=0, font=f_text)
    draw.text((1700, 500), '900.00', fill=0, font=f_text)
    draw.line([(100, 560), (1900, 560)], fill=0, width=2)

    draw.text((1300, 600), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1700, 600), '2180.00', fill=0, font=f_text)
    draw.text((1300, 645), 'CGST 9%:', fill=0, font=f_text)
    draw.text((1700, 645), '196.20', fill=0, font=f_text)
    draw.text((1300, 690), 'SGST 9%:', fill=0, font=f_text)
    draw.text((1700, 690), '196.20', fill=0, font=f_text)
    draw.line([(1300, 735), (1900, 735)], fill=0, width=3)
    draw.text((1300, 760), 'Grand Total:', fill=0, font=f_title)
    draw.text((1700, 760), '2572.40', fill=0, font=f_title)

    # Apply mobile illumination gradient
    arr = np.array(img, dtype=float)
    h_arr, w_arr = arr.shape
    for y in range(h_arr):
        arr[y, :] = np.clip(arr[y, :] - ((h_arr - y) * 0.03), 40, 255)
    photo = Image.fromarray(arr.astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=0.5))

    buf = io.BytesIO()
    photo.save(buf, format='JPEG', quality=88)
    return buf.getvalue(), "holdout_mobile.jpg"

def generate_holdout_discrepancy_invoice():
    """
    Holdout 5: Arithmetic Calculation Discrepancy on unseen vendor layout.
    Printed Grand Total ₹3850.00 vs Actual Sum ₹3696.00 (Discrepancy: ₹154.00).
    """
    img = Image.new('L', (2000, 1300), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(36, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Microtech Dynamics Ltd', fill=0, font=f_bold)
    draw.text((100, 185), 'GSTIN: 27AABCM8822N1Z4', fill=0, font=f_bold)
    draw.text((100, 230), 'Invoice No: MTD-2026-88', fill=0, font=f_bold)
    draw.text((100, 275), 'Date: 11/11/2026', fill=0, font=f_text)

    draw.line([(100, 340), (1900, 340)], fill=0, width=2)
    draw.text((100, 360), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 360), 'Qty', fill=0, font=f_bold)
    draw.text((1350, 360), 'Rate', fill=0, font=f_bold)
    draw.text((1600, 360), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 410), (1900, 410)], fill=0, width=2)

    draw.text((100, 440), 'Relay Module 4-Channel 5V Optocoupler', fill=0, font=f_text)
    draw.text((1150, 440), '10', fill=0, font=f_text)
    draw.text((1350, 440), '160.00', fill=0, font=f_text)
    draw.text((1600, 440), '1600.00', fill=0, font=f_text)

    draw.text((100, 500), 'Current Sensor Module ACS712 20A', fill=0, font=f_text)
    draw.text((1150, 500), '8', fill=0, font=f_text)
    draw.text((1350, 500), '190.00', fill=0, font=f_text)
    draw.text((1600, 500), '1520.00', fill=0, font=f_text)
    draw.line([(100, 560), (1900, 560)], fill=0, width=2)

    draw.text((1200, 600), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1600, 600), '3120.00', fill=0, font=f_text)
    draw.text((1200, 645), 'CGST 9%:', fill=0, font=f_text)
    draw.text((1600, 645), '280.80', fill=0, font=f_text)
    draw.text((1200, 690), 'SGST 9%:', fill=0, font=f_text)
    draw.text((1600, 690), '280.80', fill=0, font=f_text)
    draw.line([(1200, 735), (1900, 735)], fill=0, width=2)
    # Printed math error: printed 3850.00 instead of 3681.60 (3120 + 561.60)
    draw.text((1200, 765), 'Grand Total:', fill=0, font=f_title)
    draw.text((1600, 765), '3850.00', fill=0, font=f_title)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue(), "holdout_discrepancy.png"

def generate_holdout_high_volume_invoice():
    """
    Holdout 6: High Volume multi-item invoice (6 distinct components).
    Tests similar prefixes/suffixes across precision discrete parts.
    """
    img = Image.new('L', (2200, 1700), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(36, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Precision Semiconductor Spares', fill=0, font=f_bold)
    draw.text((100, 185), 'GSTIN: 33AAQFS5512B1Z9', fill=0, font=f_bold)
    draw.text((100, 230), 'Invoice No: PSS-2026-441', fill=0, font=f_bold)
    draw.text((100, 275), 'Date: 01/12/2026', fill=0, font=f_text)

    draw.line([(100, 330), (2100, 330)], fill=0, width=3)
    draw.text((100, 350), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 350), 'Qty', fill=0, font=f_bold)
    draw.text((1350, 350), 'Rate', fill=0, font=f_bold)
    draw.text((1650, 350), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 395), (2100, 395)], fill=0, width=2)

    items = [
        ('NE555P Precision Timer DIP-8', 50, 9.0, 450.0),
        ('NE555D Precision Timer SOIC-8', 50, 11.0, 550.0),
        ('LM7805CT Linear Voltage Regulator 5V', 20, 22.0, 440.0),
        ('LM7812CT Linear Voltage Regulator 12V', 20, 24.0, 480.0),
        ('1N4007 Standard Rectifier Diode 1A', 100, 1.5, 150.0),
        ('1N4148 Fast Switching Diode 100V', 100, 1.2, 120.0),
    ]

    y = 425
    for desc, q, r, tot in items:
        draw.text((100, y), desc, fill=0, font=f_text)
        draw.text((1150, y), str(q), fill=0, font=f_text)
        draw.text((1350, y), f"{r:.2f}", fill=0, font=f_text)
        draw.text((1650, y), f"{tot:.2f}", fill=0, font=f_text)
        y += 55

    draw.line([(100, y), (2100, y)], fill=0, width=2)
    y += 25
    draw.text((1200, y), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1650, y), '2190.00', fill=0, font=f_text)
    y += 45
    draw.text((1200, y), 'CGST 9%:', fill=0, font=f_text)
    draw.text((1650, y), '197.10', fill=0, font=f_text)
    y += 45
    draw.text((1200, y), 'SGST 9%:', fill=0, font=f_text)
    draw.text((1650, y), '197.10', fill=0, font=f_text)
    y += 45
    draw.line([(1200, y), (2100, y)], fill=0, width=3)
    y += 25
    draw.text((1200, y), 'Grand Total:', fill=0, font=f_title)
    draw.text((1650, y), '2584.20', fill=0, font=f_title)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue(), "holdout_high_volume.png"

# ---------------------------------------------------------------------------
# Holdout Ground Truth Definitions
# ---------------------------------------------------------------------------

HOLDOUT_GROUND_TRUTH = {
    "holdout_mouser.pdf": {
        "supplier_name": "Mouser Electronics India",
        "supplier_gst": "29AAACM2219P1ZU",
        "invoice_number": "MSR-IN-2026-904",
        "invoice_date": "14/06/2026",
        "printed_grand_total": 4632.0,
        "has_discrepancy": False,
        "items_count": 3,
        "items": [
            {"desc": "ESP32-WROOM-32E Wi-Fi + BLE Module", "qty": 10, "price": 280.0, "total": 2800.0},
            {"desc": "AMS1117-3.3 SOT-223 Voltage Regulator", "qty": 50, "price": 8.5, "total": 425.0},
            {"desc": "CH340G USB to UART Bridge SOP-16", "qty": 20, "price": 35.0, "total": 700.0}
        ]
    },
    "holdout_digikey.png": {
        "supplier_name": "Semikart India Private Limited",
        "supplier_gst": "29AAGCS8811K1Z2",
        "invoice_number": "SK-2026-551",
        "invoice_date": "2026-07-19",
        "printed_grand_total": 2950.0,
        "has_discrepancy": False,
        "items_count": 2,
        "items": [
            {"desc": "ATmega328P-PU Microcontroller DIP-28", "qty": 5, "price": 210.0, "total": 1050.0},
            {"desc": "ATTINY85-20PU 8-bit AVR DIP-8", "qty": 10, "price": 145.0, "total": 1450.0}
        ]
    },
    "holdout_thermal.jpg": {
        "supplier_name": "SP Road Components Centre",
        "supplier_gst": None, # Non-GST! Zero hallucination check
        "invoice_number": "SPR-8812",
        "invoice_date": "05/08/2026",
        "printed_grand_total": 540.0,
        "has_discrepancy": False,
        "items_count": 2,
        "items": [
            {"desc": "Solder Wire 60/40 50g Reel", "qty": 2, "price": 180.0, "total": 360.0},
            {"desc": "Heat Shrink Tube 3mm 5m Pack", "qty": 3, "price": 60.0, "total": 180.0}
        ]
    },
    "holdout_mobile.jpg": {
        "supplier_name": "Silverline Electronics",
        "supplier_gst": "36AAIFS9900L1ZQ",
        "invoice_number": "SLE-2026-102",
        "invoice_date": "30/09/2026",
        "printed_grand_total": 2572.40,
        "has_discrepancy": False,
        "items_count": 2,
        "items": [
            {"desc": "BME280 Temperature Humidity Sensor Module", "qty": 4, "price": 320.0, "total": 1280.0},
            {"desc": "MPU6050 6-Axis Gyro Accelerometer Module", "qty": 6, "price": 150.0, "total": 900.0}
        ]
    },
    "holdout_discrepancy.png": {
        "supplier_name": "Microtech Dynamics Ltd",
        "supplier_gst": "27AABCM8822N1Z4",
        "invoice_number": "MTD-2026-88",
        "invoice_date": "11/11/2026",
        "printed_grand_total": 3850.0,
        "has_discrepancy": True,
        "discrepancy_amount": 168.40,
        "items_count": 2,
        "items": [
            {"desc": "Relay Module 4-Channel 5V Optocoupler", "qty": 10, "price": 160.0, "total": 1600.0},
            {"desc": "Current Sensor Module ACS712 20A", "qty": 8, "price": 190.0, "total": 1520.0}
        ]
    },
    "holdout_high_volume.png": {
        "supplier_name": "Precision Semiconductor Spares",
        "supplier_gst": "33AAQFS5512B1Z9",
        "invoice_number": "PSS-2026-441",
        "invoice_date": "01/12/2026",
        "printed_grand_total": 2584.20,
        "has_discrepancy": False,
        "items_count": 6,
        "items": [
            {"desc": "NE555P Precision Timer DIP-8", "qty": 50, "price": 9.0, "total": 450.0},
            {"desc": "NE555D Precision Timer SOIC-8", "qty": 50, "price": 11.0, "total": 550.0},
            {"desc": "LM7805CT Linear Voltage Regulator 5V", "qty": 20, "price": 22.0, "total": 440.0},
            {"desc": "LM7812CT Linear Voltage Regulator 12V", "qty": 20, "price": 24.0, "total": 480.0},
            {"desc": "1N4007 Standard Rectifier Diode 1A", "qty": 100, "price": 1.5, "total": 150.0},
            {"desc": "1N4148 Fast Switching Diode 100V", "qty": 100, "price": 1.2, "total": 120.0}
        ]
    }
}

# ---------------------------------------------------------------------------
# Evaluation Runner
# ---------------------------------------------------------------------------

async def run_holdout_evaluation():
    generators = [
        generate_holdout_mouser_pdf,
        generate_holdout_digikey_invoice,
        generate_holdout_thermal_receipt,
        generate_holdout_mobile_photo,
        generate_holdout_discrepancy_invoice,
        generate_holdout_high_volume_invoice
    ]

    total_invoices = len(generators)
    successful_invoices = 0
    total_fields = 0
    correct_fields = 0
    false_positives = 0
    missing_values = 0
    discrepancy_tests = 0
    discrepancies_detected = 0
    durations = []

    print("=" * 90)
    print("INDEPENDENT HOLDOUT SUPPLIER INVOICE EVALUATION (UNSEEN DATASET)")
    print("=" * 90)

    for gen in generators:
        content, filename = gen()
        gt = HOLDOUT_GROUND_TRUTH[filename]
        t0 = time.time()

        # Run purchase_ocr endpoint processing
        mock_upload = UploadFile(filename=filename, file=io.BytesIO(content))
        user = {"uid": "admin", "role": "super_admin", "name": "Admin"}
        res = await purchase_ocr(file=mock_upload, user=user)
        duration = time.time() - t0
        durations.append(duration)

        meta = res.get("metadata", {})
        line_items = res.get("line_items", [])

        fields_tested = []
        inv_passed = True

        # 1. Supplier Name
        gt_supp = gt["supplier_name"]
        ext_supp = meta.get("supplier_name")
        supp_match = (ext_supp is not None and gt_supp.lower() in ext_supp.lower()) if gt_supp else (ext_supp is None)
        fields_tested.append(("Supplier Name", gt_supp, ext_supp, supp_match))

        # 2. GSTIN
        gt_gst = gt["supplier_gst"]
        ext_gst = meta.get("supplier_gst")
        if gt_gst is None:
            gst_match = (ext_gst is None)
            if ext_gst is not None:
                false_positives += 1
        else:
            gst_match = (ext_gst == gt_gst)
            if ext_gst is None:
                missing_values += 1
        fields_tested.append(("GSTIN", gt_gst, ext_gst, gst_match))

        # 3. Invoice Number
        gt_inv = gt["invoice_number"]
        ext_inv = meta.get("invoice_number")
        inv_match = (ext_inv == gt_inv) if gt_inv else (ext_inv is None)
        if gt_inv and not ext_inv:
            missing_values += 1
        fields_tested.append(("Invoice Number", gt_inv, ext_inv, inv_match))

        # 4. Invoice Date
        gt_dt = gt["invoice_date"]
        ext_dt = meta.get("invoice_date")
        dt_match = (ext_dt == gt_dt) if gt_dt else (ext_dt is None)
        fields_tested.append(("Invoice Date", gt_dt, ext_dt, dt_match))

        # 5. Grand Total
        gt_gt = gt["printed_grand_total"]
        ext_gt = meta.get("printed_grand_total") or meta.get("grand_total")
        gt_match = (ext_gt is not None and abs(ext_gt - gt_gt) < 1.0)
        fields_tested.append(("Grand Total", gt_gt, ext_gt, gt_match))

        # 6. Discrepancy Detection
        gt_disc = gt["has_discrepancy"]
        ext_disc = meta.get("has_discrepancy", False)
        disc_match = (gt_disc == ext_disc)
        if gt_disc:
            discrepancy_tests += 1
            if ext_disc:
                discrepancies_detected += 1
        fields_tested.append(("Discrepancy Flag", gt_disc, ext_disc, disc_match))

        # 7. Line Items Count
        gt_count = gt["items_count"]
        ext_count = len(line_items)
        count_match = (ext_count == gt_count)
        fields_tested.append(("Line Items Count", gt_count, ext_count, count_match))

        # 8. Verbatim Descriptions
        desc_matches = []
        for i, gt_item in enumerate(gt["items"]):
            if i < len(line_items):
                ext_item = line_items[i]
                d_match = (gt_item["desc"].lower() in ext_item["item_name"].lower() or 
                           gt_item["desc"].lower() in (ext_item.get("original_item_name") or "").lower())
                desc_matches.append(d_match)
            else:
                desc_matches.append(False)
        all_desc_match = all(desc_matches) if desc_matches else False
        fields_tested.append(("Verbatim Items", f"{len(gt['items'])} items", f"{sum(desc_matches)} matched", all_desc_match))

        # Tally scores
        for name, expected, actual, passed in fields_tested:
            total_fields += 1
            if passed:
                correct_fields += 1
            else:
                inv_passed = False

        if inv_passed:
            successful_invoices += 1

        print(f"\n[HOLDOUT INVOICE] {filename} (Duration: {duration:.2f}s) - Status: {'✓ PASS' if inv_passed else '✕ FAIL'}")
        print("-" * 90)
        for name, expected, actual, passed in fields_tested:
            mark = "✓" if passed else "✕"
            print(f" {mark} {name:20} | Expected: {str(expected):32} | Extracted: {str(actual):32}")

    field_accuracy = (correct_fields / total_fields) * 100.0 if total_fields else 0.0
    inv_accuracy = (successful_invoices / total_invoices) * 100.0 if total_invoices else 0.0
    disc_rate = (discrepancies_detected / discrepancy_tests) * 100.0 if discrepancy_tests else 100.0
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    max_duration = max(durations) if durations else 0.0

    print("\n" + "=" * 90)
    print("INDEPENDENT HOLDOUT EVALUATION SUMMARY")
    print("=" * 90)
    print(f"Total Holdout Invoices:      {total_invoices}")
    print(f"Successful Invoices:        {successful_invoices} / {total_invoices} ({inv_accuracy:.1f}%)")
    print(f"Total Evaluated Fields:     {total_fields}")
    print(f"Correct Fields:             {correct_fields} / {total_fields} ({field_accuracy:.1f}%)")
    print(f"False Positives (Guesses):  {false_positives}")
    print(f"Missing Values:             {missing_values}")
    print(f"Discrepancy Detection Rate: {disc_rate:.1f}%")
    print(f"Average Processing Time:    {avg_duration:.2f}s")
    print(f"Maximum Processing Time:    {max_duration:.2f}s")
    print("=" * 90)

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_holdout_evaluation())

