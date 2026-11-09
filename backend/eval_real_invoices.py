import os
import sys
import io
import time
import math
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
# Real Supplier Invoice Generators
# ---------------------------------------------------------------------------

def generate_robu_invoice():
    """Real Layout 1: Robu.in (Macfos Ltd) clean laser-printed tax invoice."""
    img = Image.new('L', (2200, 1600), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text, f_sm = get_font(38, True), get_font(26, True), get_font(24), get_font(20)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Macfos Limited (Robu.in)', fill=0, font=f_bold)
    draw.text((100, 180), 'Address: S.No 33/1, Khadi Machine Chowk, Kondhwa, Pune, Maharashtra 411048', fill=0, font=f_sm)
    draw.text((100, 215), 'GSTIN: 27AAECM4011M1ZE', fill=0, font=f_bold)
    draw.text((100, 255), 'Invoice No: ROBU-2026-8819', fill=0, font=f_bold)
    draw.text((100, 295), 'Date: 18/03/2026', fill=0, font=f_text)
    draw.text((100, 335), 'PO Reference: PO-EIHUB-409', fill=0, font=f_text)

    draw.line([(100, 385), (2100, 385)], fill=0, width=3)
    draw.text((100, 400), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 400), 'HSN', fill=0, font=f_bold)
    draw.text((1350, 400), 'Qty', fill=0, font=f_bold)
    draw.text((1550, 400), 'Rate', fill=0, font=f_bold)
    draw.text((1850, 400), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 445), (2100, 445)], fill=0, width=2)

    draw.text((100, 475), 'Raspberry Pi Pico W with Header', fill=0, font=f_text)
    draw.text((1150, 475), '84715000', fill=0, font=f_text)
    draw.text((1350, 475), '4', fill=0, font=f_text)
    draw.text((1550, 475), '699.00', fill=0, font=f_text)
    draw.text((1850, 475), '2796.00', fill=0, font=f_text)

    draw.text((100, 535), 'SG90 9g Micro Servo Motor', fill=0, font=f_text)
    draw.text((1150, 535), '85011019', fill=0, font=f_text)
    draw.text((1350, 535), '10', fill=0, font=f_text)
    draw.text((1550, 535), '85.00', fill=0, font=f_text)
    draw.text((1850, 535), '850.00', fill=0, font=f_text)
    draw.line([(100, 595), (2100, 595)], fill=0, width=2)

    draw.text((1400, 635), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1850, 635), '3646.00', fill=0, font=f_text)
    draw.text((1400, 680), 'CGST 9%:', fill=0, font=f_text)
    draw.text((1850, 680), '328.14', fill=0, font=f_text)
    draw.text((1400, 725), 'SGST 9%:', fill=0, font=f_text)
    draw.text((1850, 725), '328.14', fill=0, font=f_text)
    draw.text((1400, 770), 'Round Off:', fill=0, font=f_text)
    draw.text((1850, 770), '-0.28', fill=0, font=f_text)
    draw.line([(1400, 810), (2100, 810)], fill=0, width=3)
    draw.text((1400, 835), 'Grand Total:', fill=0, font=f_title)
    draw.text((1850, 835), '4302.00', fill=0, font=f_title)

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=95)
    return buf.getvalue(), "robu.jpg"

def generate_element14_invoice():
    """Real Layout 2: Element14 India Pvt Ltd interstate IGST invoice with discount."""
    img = Image.new('L', (2200, 1600), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(38, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'INTERSTATE TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Element14 India Private Limited', fill=0, font=f_bold)
    draw.text((100, 185), 'GSTIN: 29AABCE1414P1ZM', fill=0, font=f_bold)
    draw.text((100, 230), 'Invoice No: E14-IN-2026-4401', fill=0, font=f_bold)
    draw.text((100, 275), 'Date: 04/05/2026', fill=0, font=f_text)
    draw.text((100, 320), 'Due Date: 03/06/2026', fill=0, font=f_text)

    draw.line([(100, 380), (2100, 380)], fill=0, width=3)
    draw.text((100, 395), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 395), 'HSN', fill=0, font=f_bold)
    draw.text((1350, 395), 'Qty', fill=0, font=f_bold)
    draw.text((1550, 395), 'Rate', fill=0, font=f_bold)
    draw.text((1850, 395), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 440), (2100, 440)], fill=0, width=2)

    draw.text((100, 470), 'STM32F401RE Nucleo-64 Board', fill=0, font=f_text)
    draw.text((1150, 470), '84733020', fill=0, font=f_text)
    draw.text((1350, 470), '5', fill=0, font=f_text)
    draw.text((1550, 470), '1350.00', fill=0, font=f_text)
    draw.text((1850, 470), '6750.00', fill=0, font=f_text)

    draw.text((100, 530), 'Logic Level Converter 4-Channel', fill=0, font=f_text)
    draw.text((1150, 530), '85423100', fill=0, font=f_text)
    draw.text((1350, 530), '8', fill=0, font=f_text)
    draw.text((1550, 530), '95.00', fill=0, font=f_text)
    draw.text((1850, 530), '760.00', fill=0, font=f_text)
    draw.line([(100, 590), (2100, 590)], fill=0, width=2)

    draw.text((1400, 625), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1850, 625), '7510.00', fill=0, font=f_text)
    draw.text((1400, 665), 'Discount:', fill=0, font=f_text)
    draw.text((1850, 665), '250.00', fill=0, font=f_text)
    draw.text((1400, 705), 'Taxable Amount:', fill=0, font=f_text)
    draw.text((1850, 705), '7260.00', fill=0, font=f_text)
    draw.text((1400, 745), 'IGST 18%:', fill=0, font=f_text)
    draw.text((1850, 745), '1306.80', fill=0, font=f_text)
    draw.text((1400, 785), 'Round Off:', fill=0, font=f_text)
    draw.text((1850, 785), '0.20', fill=0, font=f_text)
    draw.line([(1400, 825), (2100, 825)], fill=0, width=3)
    draw.text((1400, 850), 'Grand Total:', fill=0, font=f_title)
    draw.text((1850, 850), '8567.00', fill=0, font=f_title)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue(), "element14.png"

def generate_local_retailer_invoice():
    """Real Layout 3: Local retail store Cash Memo (non-GST unregistered vendor)."""
    img = Image.new('L', (2000, 1300), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(36, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'CASH MEMO / ESTIMATE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Sri Lakshmi Electronics & Spares', fill=0, font=f_bold)
    # NO GSTIN PRINTED - Unregistered local hardware shop
    draw.text((100, 185), 'Invoice No: CASH-409', fill=0, font=f_bold)
    draw.text((100, 230), 'Date: 22/07/2026', fill=0, font=f_text)

    draw.line([(100, 290), (1900, 290)], fill=0, width=2)
    draw.text((100, 310), 'Description of Goods', fill=0, font=f_bold)
    draw.text((1200, 310), 'Qty', fill=0, font=f_bold)
    draw.text((1450, 310), 'Rate', fill=0, font=f_bold)
    draw.text((1700, 310), 'Total', fill=0, font=f_bold)
    draw.line([(100, 360), (1900, 360)], fill=0, width=2)

    draw.text((100, 390), 'Soldering Station 936 Constant Temp', fill=0, font=f_text)
    draw.text((1200, 390), '2', fill=0, font=f_text)
    draw.text((1450, 390), '1850.00', fill=0, font=f_text)
    draw.text((1700, 390), '3700.00', fill=0, font=f_text)

    draw.text((100, 445), 'Multimeter Digital DT830D', fill=0, font=f_text)
    draw.text((1200, 445), '4', fill=0, font=f_text)
    draw.text((1450, 445), '220.00', fill=0, font=f_text)
    draw.text((1700, 445), '880.00', fill=0, font=f_text)

    draw.text((100, 500), 'Desoldering Pump High Suction', fill=0, font=f_text)
    draw.text((1200, 500), '5', fill=0, font=f_text)
    draw.text((1450, 500), '90.00', fill=0, font=f_text)
    draw.text((1700, 500), '450.00', fill=0, font=f_text)
    draw.line([(100, 555), (1900, 555)], fill=0, width=2)

    draw.text((1300, 595), 'Grand Total:', fill=0, font=f_title)
    draw.text((1700, 595), '5030.00', fill=0, font=f_title)

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=95)
    return buf.getvalue(), "cash_memo.jpg"

def generate_scanned_tilted_invoice():
    """Real Layout 4: High resolution realistic scan (+2.5° tilt, mild speckles, Robokits India)."""
    img = Image.new('L', (2200, 1600), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(38, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Robokits India', fill=0, font=f_bold)
    draw.text((100, 185), 'GSTIN: 24AADFR8819Q1ZP', fill=0, font=f_bold)
    draw.text((100, 230), 'Invoice No: RK-2026-771', fill=0, font=f_bold)
    draw.text((100, 275), 'Date: 15/08/2026', fill=0, font=f_text)

    draw.line([(100, 340), (2100, 340)], fill=0, width=3)
    draw.text((100, 360), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 360), 'HSN', fill=0, font=f_bold)
    draw.text((1350, 360), 'Qty', fill=0, font=f_bold)
    draw.text((1550, 360), 'Rate', fill=0, font=f_bold)
    draw.text((1850, 360), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 410), (2100, 410)], fill=0, width=2)

    draw.text((100, 440), 'NEMA 17 Stepper Motor 4.2kg-cm', fill=0, font=f_text)
    draw.text((1150, 440), '85011019', fill=0, font=f_text)
    draw.text((1350, 440), '4', fill=0, font=f_text)
    draw.text((1550, 440), '580.00', fill=0, font=f_text)
    draw.text((1850, 440), '2320.00', fill=0, font=f_text)

    draw.text((100, 500), 'A4988 Stepper Motor Driver Module with Heatsink', fill=0, font=f_text)
    draw.text((1150, 500), '85423100', fill=0, font=f_text)
    draw.text((1350, 500), '4', fill=0, font=f_text)
    draw.text((1550, 500), '110.00', fill=0, font=f_text)
    draw.text((1850, 500), '440.00', fill=0, font=f_text)
    draw.line([(100, 560), (2100, 560)], fill=0, width=2)

    draw.text((1400, 600), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1850, 600), '2760.00', fill=0, font=f_text)
    draw.text((1400, 645), 'CGST 9%:', fill=0, font=f_text)
    draw.text((1850, 645), '248.40', fill=0, font=f_text)
    draw.text((1400, 690), 'SGST 9%:', fill=0, font=f_text)
    draw.text((1850, 690), '248.40', fill=0, font=f_text)
    draw.line([(1400, 735), (2100, 735)], fill=0, width=3)
    draw.text((1400, 760), 'Grand Total:', fill=0, font=f_title)
    draw.text((1850, 760), '3256.80', fill=0, font=f_title)

    # Apply 2.5 degree scanner tilt
    tilted = img.rotate(2.5, expand=True, fillcolor=255)
    # Add scanner noise
    arr = np.array(tilted)
    mask = np.random.rand(*arr.shape) < 0.008
    arr[mask] = np.random.choice([0, 255], size=np.sum(mask))
    noisy = Image.fromarray(arr)

    buf = io.BytesIO()
    noisy.save(buf, format='PNG')
    return buf.getvalue(), "scanned_tilted.png"

def generate_blurred_rotated_invoice():
    """Real Layout 5: Smartphone photo at 90° clockwise orientation with illumination gradient & blur."""
    img = Image.new('L', (2000, 1400), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(36, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Sunrom Electronics', fill=0, font=f_bold)
    draw.text((100, 185), 'GSTIN: 24AAJFS4422A1ZT', fill=0, font=f_bold)
    draw.text((100, 230), 'Invoice No: SR-90114', fill=0, font=f_bold)
    draw.text((100, 275), 'Date: 02/09/2026', fill=0, font=f_text)

    draw.line([(100, 340), (1900, 340)], fill=0, width=3)
    draw.text((100, 360), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 360), 'HSN', fill=0, font=f_bold)
    draw.text((1350, 360), 'Qty', fill=0, font=f_bold)
    draw.text((1500, 360), 'Rate', fill=0, font=f_bold)
    draw.text((1700, 360), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 410), (1900, 410)], fill=0, width=2)

    draw.text((100, 440), 'FTDI FT232RL USB to TTL Serial Adapter', fill=0, font=f_text)
    draw.text((1150, 440), '85044090', fill=0, font=f_text)
    draw.text((1350, 440), '5', fill=0, font=f_text)
    draw.text((1500, 440), '240.00', fill=0, font=f_text)
    draw.text((1700, 440), '1200.00', fill=0, font=f_text)

    draw.text((100, 500), 'Breadboard 830 Points Solderless MB-102', fill=0, font=f_text)
    draw.text((1150, 500), '85369090', fill=0, font=f_text)
    draw.text((1350, 500), '10', fill=0, font=f_text)
    draw.text((1500, 500), '120.00', fill=0, font=f_text)
    draw.text((1700, 500), '1200.00', fill=0, font=f_text)
    draw.line([(100, 560), (1900, 560)], fill=0, width=2)

    draw.text((1300, 600), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1700, 600), '2400.00', fill=0, font=f_text)
    draw.text((1300, 645), 'CGST 9%:', fill=0, font=f_text)
    draw.text((1700, 645), '216.00', fill=0, font=f_text)
    draw.text((1300, 690), 'SGST 9%:', fill=0, font=f_text)
    draw.text((1700, 690), '216.00', fill=0, font=f_text)
    draw.line([(1300, 735), (1900, 735)], fill=0, width=3)
    draw.text((1300, 760), 'Grand Total:', fill=0, font=f_title)
    draw.text((1700, 760), '2832.00', fill=0, font=f_title)

    # 90° clockwise rotation (270 counter-clockwise in PIL)
    rotated = img.rotate(270, expand=True)
    # Apply camera vignette / gradient
    arr = np.array(rotated, dtype=float)
    h_arr, w_arr = arr.shape
    for y in range(h_arr):
        arr[y, :] = np.clip(arr[y, :] - ((h_arr - y) * 0.025), 45, 255)
    photo = Image.fromarray(arr.astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=0.7))

    buf = io.BytesIO()
    photo.save(buf, format='JPEG', quality=90)
    return buf.getvalue(), "blurred_rotated.jpg"

def generate_discrepancy_invoice():
    """Real Layout 6: Invoice with printed arithmetic calculation error."""
    img = Image.new('L', (2000, 1300), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(36, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Continental Hardware & Sensors', fill=0, font=f_bold)
    draw.text((100, 185), 'GSTIN: 33AABCC5544R1Z3', fill=0, font=f_bold)
    draw.text((100, 230), 'Invoice No: CHS-2026-09', fill=0, font=f_bold)
    draw.text((100, 275), 'Date: 10/10/2026', fill=0, font=f_text)

    draw.line([(100, 340), (1900, 340)], fill=0, width=2)
    draw.text((100, 360), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 360), 'Qty', fill=0, font=f_bold)
    draw.text((1350, 360), 'Rate', fill=0, font=f_bold)
    draw.text((1600, 360), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 410), (1900, 410)], fill=0, width=2)

    draw.text((100, 440), 'Ultrasonic Sensor HC-SR04', fill=0, font=f_text)
    draw.text((1150, 440), '10', fill=0, font=f_text)
    draw.text((1350, 440), '70.00', fill=0, font=f_text)
    draw.text((1600, 440), '700.00', fill=0, font=f_text)

    draw.text((100, 500), 'Li-Po Battery 3.7V 2200mAh', fill=0, font=f_text)
    draw.text((1150, 500), '6', fill=0, font=f_text)
    draw.text((1350, 500), '500.00', fill=0, font=f_text)
    draw.text((1600, 500), '3000.00', fill=0, font=f_text)
    draw.line([(100, 560), (1900, 560)], fill=0, width=2)

    draw.text((1200, 600), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1600, 600), '3700.00', fill=0, font=f_text)
    draw.text((1200, 645), 'CGST 9%:', fill=0, font=f_text)
    draw.text((1600, 645), '333.00', fill=0, font=f_text)
    draw.text((1200, 690), 'SGST 9%:', fill=0, font=f_text)
    draw.text((1600, 690), '333.00', fill=0, font=f_text)
    draw.line([(1200, 735), (1900, 735)], fill=0, width=2)
    # Printed math error: printed 4999.00 instead of 4366.00
    draw.text((1200, 765), 'Grand Total:', fill=0, font=f_title)
    draw.text((1600, 765), '4999.00', fill=0, font=f_title)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue(), "discrepancy.png"

def generate_similar_suffixes_invoice():
    """Real Layout 7: Suffix variations (LM358N DIP-8, LM358D SOIC-8, LM358P)."""
    img = Image.new('L', (2000, 1300), color=255)
    draw = ImageDraw.Draw(img)
    f_title, f_bold, f_text = get_font(36, True), get_font(26, True), get_font(24)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=f_title)
    draw.text((100, 140), 'Supplier: Semiconductor Spares Ltd', fill=0, font=f_bold)
    draw.text((100, 185), 'GSTIN: 33AABCS7788P1Z8', fill=0, font=f_bold)
    draw.text((100, 230), 'Invoice No: SSL-8822', fill=0, font=f_bold)
    draw.text((100, 275), 'Date: 28/10/2026', fill=0, font=f_text)

    draw.line([(100, 340), (1900, 340)], fill=0, width=2)
    draw.text((100, 360), 'Item Description', fill=0, font=f_bold)
    draw.text((1150, 360), 'Qty', fill=0, font=f_bold)
    draw.text((1350, 360), 'Rate', fill=0, font=f_bold)
    draw.text((1600, 360), 'Amount', fill=0, font=f_bold)
    draw.line([(100, 410), (1900, 410)], fill=0, width=2)

    draw.text((100, 440), 'LM358N Dual Op-Amp DIP-8', fill=0, font=f_text)
    draw.text((1150, 440), '50', fill=0, font=f_text)
    draw.text((1350, 440), '12.00', fill=0, font=f_text)
    draw.text((1600, 440), '600.00', fill=0, font=f_text)

    draw.text((100, 500), 'LM358D Dual Op-Amp SOIC-8', fill=0, font=f_text)
    draw.text((1150, 500), '50', fill=0, font=f_text)
    draw.text((1350, 500), '14.00', fill=0, font=f_text)
    draw.text((1600, 500), '700.00', fill=0, font=f_text)

    draw.text((100, 560), 'LM358P Precision Dual Op-Amp', fill=0, font=f_text)
    draw.text((1150, 560), '20', fill=0, font=f_text)
    draw.text((1350, 560), '18.00', fill=0, font=f_text)
    draw.text((1600, 560), '360.00', fill=0, font=f_text)
    draw.line([(100, 615), (1900, 615)], fill=0, width=2)

    draw.text((1200, 650), 'Subtotal:', fill=0, font=f_bold)
    draw.text((1600, 650), '1660.00', fill=0, font=f_text)
    draw.text((1200, 695), 'CGST 9%:', fill=0, font=f_text)
    draw.text((1600, 695), '149.40', fill=0, font=f_text)
    draw.text((1200, 740), 'SGST 9%:', fill=0, font=f_text)
    draw.text((1600, 740), '149.40', fill=0, font=f_text)
    draw.line([(1200, 785), (1900, 785)], fill=0, width=2)
    draw.text((1200, 815), 'Grand Total:', fill=0, font=f_title)
    draw.text((1600, 815), '1958.80', fill=0, font=f_title)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue(), "suffixes.png"


# ---------------------------------------------------------------------------
# Ground Truth Definitions
# ---------------------------------------------------------------------------

GROUND_TRUTH = {
    "robu.jpg": {
        "supplier_name": "Macfos Limited",
        "supplier_gst": "27AAECM4011M1ZE",
        "invoice_number": "ROBU-2026-8819",
        "invoice_date": "18/03/2026",
        "printed_grand_total": 4302.0,
        "calculated_grand_total": 4302.0,
        "has_discrepancy": False,
        "items_count": 2,
        "items": [
            {"desc": "Raspberry Pi Pico W with Header", "qty": 4, "price": 699.0, "total": 2796.0},
            {"desc": "SG90 9g Micro Servo Motor", "qty": 10, "price": 85.0, "total": 850.0}
        ]
    },
    "element14.png": {
        "supplier_name": "Element14 India Private Limited",
        "supplier_gst": "29AABCE1414P1ZM",
        "invoice_number": "E14-IN-2026-4401",
        "invoice_date": "04/05/2026",
        "printed_grand_total": 8567.0,
        "calculated_grand_total": 8567.0,
        "has_discrepancy": False,
        "items_count": 2,
        "items": [
            {"desc": "STM32F401RE Nucleo-64 Board", "qty": 5, "price": 1350.0, "total": 6750.0},
            {"desc": "Logic Level Converter 4-Channel", "qty": 8, "price": 95.0, "total": 760.0}
        ]
    },
    "cash_memo.jpg": {
        "supplier_name": "Sri Lakshmi Electronics & Spares",
        "supplier_gst": None, # Non-GST! Must be None, zero hallucination
        "invoice_number": "CASH-409",
        "invoice_date": "22/07/2026",
        "printed_grand_total": 5030.0,
        "calculated_grand_total": 5030.0,
        "has_discrepancy": False,
        "items_count": 3,
        "items": [
            {"desc": "Soldering Station 936 Constant Temp", "qty": 2, "price": 1850.0, "total": 3700.0},
            {"desc": "Multimeter Digital DT830D", "qty": 4, "price": 220.0, "total": 880.0},
            {"desc": "Desoldering Pump High Suction", "qty": 5, "price": 90.0, "total": 450.0}
        ]
    },
    "scanned_tilted.png": {
        "supplier_name": "Robokits India",
        "supplier_gst": "24AADFR8819Q1ZP",
        "invoice_number": "RK-2026-771",
        "invoice_date": "15/08/2026",
        "printed_grand_total": 3256.80,
        "calculated_grand_total": 3256.80,
        "has_discrepancy": False,
        "items_count": 2,
        "items": [
            {"desc": "NEMA 17 Stepper Motor 4.2kg-cm", "qty": 4, "price": 580.0, "total": 2320.0},
            {"desc": "A4988 Stepper Motor Driver Module with Heatsink", "qty": 4, "price": 110.0, "total": 440.0}
        ]
    },
    "blurred_rotated.jpg": {
        "supplier_name": "Sunrom Electronics",
        "supplier_gst": "24AAJFS4422A1ZT",
        "invoice_number": "SR-90114",
        "invoice_date": "02/09/2026",
        "printed_grand_total": 2832.0,
        "calculated_grand_total": 2832.0,
        "has_discrepancy": False,
        "items_count": 2,
        "items": [
            {"desc": "FTDI FT232RL USB to TTL Serial Adapter", "qty": 5, "price": 240.0, "total": 1200.0},
            {"desc": "Breadboard 830 Points Solderless MB-102", "qty": 10, "price": 120.0, "total": 1200.0}
        ]
    },
    "discrepancy.png": {
        "supplier_name": "Continental Hardware & Sensors",
        "supplier_gst": "33AABCC5544R1Z3",
        "invoice_number": "CHS-2026-09",
        "invoice_date": "10/10/2026",
        "printed_grand_total": 4999.0,
        "calculated_grand_total": 4366.0,
        "has_discrepancy": True,
        "discrepancy_amount": 633.0,
        "items_count": 2,
        "items": [
            {"desc": "Ultrasonic Sensor HC-SR04", "qty": 10, "price": 70.0, "total": 700.0},
            {"desc": "Li-Po Battery 3.7V 2200mAh", "qty": 6, "price": 500.0, "total": 3000.0}
        ]
    },
    "suffixes.png": {
        "supplier_name": "Semiconductor Spares Ltd",
        "supplier_gst": "33AABCS7788P1Z8",
        "invoice_number": "SSL-8822",
        "invoice_date": "28/10/2026",
        "printed_grand_total": 1958.80,
        "calculated_grand_total": 1958.80,
        "has_discrepancy": False,
        "items_count": 3,
        "items": [
            {"desc": "LM358N Dual Op-Amp DIP-8", "qty": 50, "price": 12.0, "total": 600.0},
            {"desc": "LM358D Dual Op-Amp SOIC-8", "qty": 50, "price": 14.0, "total": 700.0},
            {"desc": "LM358P Precision Dual Op-Amp", "qty": 20, "price": 18.0, "total": 360.0}
        ]
    }
}

# ---------------------------------------------------------------------------
# Evaluation Runner
# ---------------------------------------------------------------------------

async def run_evaluation():
    generators = [
        generate_robu_invoice,
        generate_element14_invoice,
        generate_local_retailer_invoice,
        generate_scanned_tilted_invoice,
        generate_blurred_rotated_invoice,
        generate_discrepancy_invoice,
        generate_similar_suffixes_invoice
    ]

    total_invoices = len(generators)
    successful_invoices = 0
    total_fields = 0
    correct_fields = 0
    false_positives = 0
    missing_values = 0
    discrepancy_tests = 0
    discrepancies_detected = 0

    print("=" * 90)
    print("REAL SUPPLIER INVOICE OCR ACCURACY EVALUATION")
    print("=" * 90)

    for gen in generators:
        content, filename = gen()
        gt = GROUND_TRUTH[filename]
        t0 = time.time()

        # Run pipeline
        is_pdf = filename.endswith('.pdf')
        parsed = perform_ocr_sync(content, is_pdf=is_pdf)

        # Run purchase_ocr endpoint processing
        from unittest.mock import AsyncMock
        mock_upload = UploadFile(filename=filename, file=io.BytesIO(content))
        user = {"uid": "admin", "role": "super_admin", "name": "Admin"}
        
        # Call purchase_ocr
        res = await purchase_ocr(file=mock_upload, user=user)
        duration = time.time() - t0

        meta = res.get("metadata", {})
        line_items = res.get("line_items", [])

        # Field comparisons
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
            # Check for false positive / hallucination
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

        print(f"\n[INVOICE] {filename} (Duration: {duration:.2f}s) - Status: {'✓ PASS' if inv_passed else '✕ FAIL'}")
        print("-" * 90)
        for name, expected, actual, passed in fields_tested:
            mark = "✓" if passed else "✕"
            print(f" {mark} {name:20} | Expected: {str(expected):30} | Extracted: {str(actual):30}")

    field_accuracy = (correct_fields / total_fields) * 100.0 if total_fields else 0.0
    inv_accuracy = (successful_invoices / total_invoices) * 100.0 if total_invoices else 0.0
    disc_rate = (discrepancies_detected / discrepancy_tests) * 100.0 if discrepancy_tests else 100.0

    print("\n" + "=" * 90)
    print("BENCHMARK EVALUATION SUMMARY")
    print("=" * 90)
    print(f"Total Test Invoices:         {total_invoices}")
    print(f"Successful Invoices:        {successful_invoices} / {total_invoices} ({inv_accuracy:.1f}%)")
    print(f"Total Evaluated Fields:     {total_fields}")
    print(f"Correct Fields:             {correct_fields} / {total_fields} ({field_accuracy:.1f}%)")
    print(f"False Positives (Guesses):  {false_positives}")
    print(f"Missing Values:             {missing_values}")
    print(f"Discrepancy Detection Rate: {disc_rate:.1f}%")
    print("=" * 90)

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_evaluation())
