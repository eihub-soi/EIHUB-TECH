import os
import sys
import unittest
import io
from decimal import Decimal
from unittest.mock import patch
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps, ImageEnhance
import numpy as np

# Ensure test mode
os.environ["TESTING"] = "True"

# Add backend to sys.path
sys.path.append(os.path.dirname(__file__))

from app.main import app, require_admin, require_faculty_or_admin, get_current_user
from app.api.routes.import_data import configure_ocr_engine, deskew_image, auto_orient_image
from fastapi.testclient import TestClient

configure_ocr_engine()

def get_test_fonts():
    """Resolves standard Windows TrueType fonts with fallbacks."""
    try:
        font_title = ImageFont.truetype("arial.ttf", 36)
        font_bold = ImageFont.truetype("arialbd.ttf", 28)
        font_body = ImageFont.truetype("arial.ttf", 24)
    except Exception:
        font_title = font_bold = font_body = ImageFont.load_default()
    return font_title, font_bold, font_body

def build_base_invoice_image():
    """Generates a clean 300 DPI base invoice image (Bharat Electronics Ltd)."""
    font_title, font_bold, font_body = get_test_fonts()
    img = Image.new('L', (2000, 1500), color=255)
    draw = ImageDraw.Draw(img)

    draw.text((100, 80), 'TAX INVOICE', fill=0, font=font_title)
    draw.text((100, 140), 'Supplier: Bharat Electronics Ltd', fill=0, font=font_body)
    draw.text((100, 190), 'GSTIN: 29AABCB1234F1Z2', fill=0, font=font_body)
    draw.text((100, 240), 'Invoice No: BEL-2026-101', fill=0, font=font_body)
    draw.text((100, 290), 'Date: 12/04/2026', fill=0, font=font_body)

    draw.line([(100, 360), (1900, 360)], fill=0, width=3)
    draw.text((100, 380), 'Item Description', fill=0, font=font_bold)
    draw.text((950, 380), 'HSN', fill=0, font=font_bold)
    draw.text((1150, 380), 'Qty', fill=0, font=font_bold)
    draw.text((1350, 380), 'Rate', fill=0, font=font_bold)
    draw.text((1600, 380), 'Amount', fill=0, font=font_bold)
    draw.line([(100, 430), (1900, 430)], fill=0, width=2)

    draw.text((100, 460), 'Arduino Uno R3 SMD Board', fill=0, font=font_body)
    draw.text((950, 460), '854231', fill=0, font=font_body)
    draw.text((1150, 460), '10', fill=0, font=font_body)
    draw.text((1350, 460), '450.00', fill=0, font=font_body)
    draw.text((1600, 460), '4500.00', fill=0, font=font_body)

    draw.text((100, 520), 'NodeMCU ESP8266 V3 Module', fill=0, font=font_body)
    draw.text((950, 520), '854231', fill=0, font=font_body)
    draw.text((1150, 520), '20', fill=0, font=font_body)
    draw.text((1350, 520), '220.00', fill=0, font=font_body)
    draw.text((1600, 520), '4400.00', fill=0, font=font_body)
    draw.line([(100, 580), (1900, 580)], fill=0, width=2)

    draw.text((1200, 620), 'Subtotal:', fill=0, font=font_bold)
    draw.text((1600, 620), '8900.00', fill=0, font=font_body)
    draw.text((1200, 670), 'CGST 9%:', fill=0, font=font_body)
    draw.text((1600, 670), '801.00', fill=0, font=font_body)
    draw.text((1200, 720), 'SGST 9%:', fill=0, font=font_body)
    draw.text((1600, 720), '801.00', fill=0, font=font_body)
    draw.line([(1200, 770), (1900, 770)], fill=0, width=3)
    draw.text((1200, 800), 'Grand Total:', fill=0, font=font_title)
    draw.text((1600, 800), '10502.00', fill=0, font=font_title)

    return img

class TestOCRAccuracyBenchmark(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.mock_user = {"uid": "admin", "role": "super_admin", "name": "Admin"}

    def setUp(self):
        self.mock_user = {"uid": "admin", "role": "super_admin", "name": "Admin"}
        app.dependency_overrides[require_admin] = lambda: self.mock_user
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_user
        app.dependency_overrides[get_current_user] = lambda: self.mock_user

    def tearDown(self):
        app.dependency_overrides.clear()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_1_clean_digital(self, mock_db):
        """Case 1: Clean high-contrast digital invoice (JPG)."""
        mock_db.return_value = []
        img = build_base_invoice_image()
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=95)
        
        response = self.client.post(
            "/api/imports/purchase/ocr",
            files={"file": ("clean_invoice.jpg", io.BytesIO(buf.getvalue()), "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        meta = res["metadata"]
        
        self.assertEqual(meta["supplier_name"], "Bharat Electronics Ltd")
        self.assertEqual(meta["supplier_gst"], "29AABCB1234F1Z2")
        self.assertEqual(meta["invoice_number"], "BEL-2026-101")
        self.assertEqual(meta["invoice_date"], "12/04/2026")
        self.assertEqual(meta["printed_grand_total"], 10502.0)
        self.assertEqual(meta["calculated_grand_total"], 10502.0)
        self.assertFalse(meta["has_discrepancy"])
        self.assertEqual(len(res["line_items"]), 2)
        
        # Verify line items
        it1 = res["line_items"][0]
        self.assertIn("Arduino Uno", it1["item_name"])
        self.assertEqual(it1["quantity"], 10)
        self.assertEqual(it1["unit_price"], 450.0)
        self.assertEqual(it1["total"], 4500.0)

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_2_rotated_90(self, mock_db):
        """Case 2: Rotated 90° clockwise invoice (PNG) – testing auto orientation."""
        mock_db.return_value = []
        img = build_base_invoice_image()
        rotated = img.rotate(270, expand=True) # 270 counter-clockwise = 90 clockwise
        buf = io.BytesIO()
        rotated.save(buf, format='PNG')
        
        response = self.client.post(
            "/api/imports/purchase/ocr",
            files={"file": ("rotated_90.png", io.BytesIO(buf.getvalue()), "image/png")}
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        meta = res["metadata"]
        
        # Verify that orientation was detected and corrected, extracting key metadata
        self.assertIn("Bharat Electronics", str(meta.get("supplier_name", "")))
        self.assertEqual(meta["supplier_gst"], "29AABCB1234F1Z2")
        self.assertEqual(meta["invoice_number"], "BEL-2026-101")

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_3_skewed_3_5deg(self, mock_db):
        """Case 3: Skewed (+3.5°) tilted invoice (PNG) – testing projection deskewing."""
        mock_db.return_value = []
        img = build_base_invoice_image()
        tilted = img.rotate(3.5, expand=True, fillcolor=255)
        buf = io.BytesIO()
        tilted.save(buf, format='PNG')
        
        response = self.client.post(
            "/api/imports/purchase/ocr",
            files={"file": ("skewed.png", io.BytesIO(buf.getvalue()), "image/png")}
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        meta = res["metadata"]
        
        # Deskew algorithm levels horizontal text, extracting correct values
        self.assertEqual(meta["supplier_gst"], "29AABCB1234F1Z2")
        self.assertEqual(meta["invoice_number"], "BEL-2026-101")
        self.assertEqual(meta["printed_grand_total"], 10502.0)
        self.assertEqual(len(res["line_items"]), 2)

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_4_low_contrast_shaded(self, mock_db):
        """Case 4: Low-contrast invoice with gradient shadow (JPG) – testing adaptive thresholding."""
        mock_db.return_value = []
        img = build_base_invoice_image()
        
        # Apply shadow gradient across x-axis
        arr = np.array(img, dtype=float)
        w = arr.shape[1]
        for x in range(w):
            arr[:, x] = np.clip(arr[:, x] - ((w - x) * 0.04), 40, 255)
            
        shaded = Image.fromarray(arr.astype(np.uint8))
        shaded = ImageEnhance.Contrast(shaded).enhance(0.7) # reduce contrast
        buf = io.BytesIO()
        shaded.save(buf, format='JPEG', quality=85)
        
        response = self.client.post(
            "/api/imports/purchase/ocr",
            files={"file": ("shaded.jpg", io.BytesIO(buf.getvalue()), "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        meta = res["metadata"]
        
        # Adaptive thresholding preserves GSTIN and line items under shadow
        self.assertEqual(meta["supplier_gst"], "29AABCB1234F1Z2")
        self.assertGreater(len(res["line_items"]), 0)

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_5_noisy_scanner(self, mock_db):
        """Case 5: Noisy scan with salt-and-pepper artifacts (PNG) – testing median filter + Otsu."""
        mock_db.return_value = []
        img = build_base_invoice_image()
        
        arr = np.array(img)
        # Add 1.5% salt & pepper noise
        mask = np.random.rand(*arr.shape) < 0.015
        arr[mask] = np.random.choice([0, 255], size=np.sum(mask))
        noisy = Image.fromarray(arr)
        
        buf = io.BytesIO()
        noisy.save(buf, format='PNG')
        
        response = self.client.post(
            "/api/imports/purchase/ocr",
            files={"file": ("noisy.png", io.BytesIO(buf.getvalue()), "image/png")}
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        meta = res["metadata"]
        
        # Median filter cleans speckles, ensuring GSTIN is detected
        self.assertEqual(meta["supplier_gst"], "29AABCB1234F1Z2")
        self.assertEqual(meta["invoice_number"], "BEL-2026-101")

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_6_missing_gstin_po(self, mock_db):
        """Case 6: Invoice without GSTIN or PO – testing zero hallucination invariant."""
        mock_db.return_value = []
        font_title, font_bold, font_body = get_test_fonts()
        img = Image.new('L', (2000, 1200), color=255)
        draw = ImageDraw.Draw(img)

        draw.text((100, 80), 'CASH MEMO', fill=0, font=font_title)
        draw.text((100, 140), 'Supplier: Pioneer Tech Traders', fill=0, font=font_body)
        # No GSTIN printed on cash memo!
        draw.text((100, 190), 'Invoice No: PT-901', fill=0, font=font_body)
        draw.text((100, 240), 'Date: 15/05/2026', fill=0, font=font_body)

        draw.line([(100, 310), (1900, 310)], fill=0, width=2)
        draw.text((100, 330), 'Description', fill=0, font=font_bold)
        draw.text((1150, 330), 'Qty', fill=0, font=font_bold)
        draw.text((1350, 330), 'Rate', fill=0, font=font_bold)
        draw.text((1600, 330), 'Total', fill=0, font=font_bold)
        draw.line([(100, 380), (1900, 380)], fill=0, width=2)

        draw.text((100, 410), 'Soldering Iron 60W', fill=0, font=font_body)
        draw.text((1150, 410), '5', fill=0, font=font_body)
        draw.text((1350, 410), '300.00', fill=0, font=font_body)
        draw.text((1600, 410), '1500.00', fill=0, font=font_body)

        draw.line([(100, 470), (1900, 470)], fill=0, width=2)
        draw.text((1200, 510), 'Grand Total:', fill=0, font=font_title)
        draw.text((1600, 510), '1500.00', fill=0, font=font_title)

        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=95)

        response = self.client.post(
            "/api/imports/purchase/ocr",
            files={"file": ("cash_memo.jpg", io.BytesIO(buf.getvalue()), "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        meta = res["metadata"]

        # ZERO HALLUCINATION INVARIANT: GSTIN must be None / null, NEVER guessed or dummy!
        self.assertIsNone(meta["supplier_gst"])
        self.assertIn("supplier_gst", meta["uncertain_fields"])
        self.assertEqual(meta["supplier_name"], "Pioneer Tech Traders")
        self.assertEqual(meta["invoice_number"], "PT-901")
        self.assertEqual(meta["printed_grand_total"], 1500.0)

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_7_mathematical_discrepancy(self, mock_db):
        """Case 7: Printed arithmetic error on invoice – testing discrepancy detection."""
        mock_db.return_value = []
        font_title, font_bold, font_body = get_test_fonts()
        img = Image.new('L', (2000, 1300), color=255)
        draw = ImageDraw.Draw(img)

        draw.text((100, 80), 'TAX INVOICE', fill=0, font=font_title)
        draw.text((100, 140), 'Supplier: Apex Robotics', fill=0, font=font_body)
        draw.text((100, 190), 'GSTIN: 33AABCA1234F1Z1', fill=0, font=font_body)
        draw.text((100, 240), 'Invoice No: APEX-5544', fill=0, font=font_body)
        draw.text((100, 290), 'Date: 01/06/2026', fill=0, font=font_body)

        draw.line([(100, 360), (1900, 360)], fill=0, width=2)
        draw.text((100, 380), 'Item Description', fill=0, font=font_bold)
        draw.text((1150, 380), 'Qty', fill=0, font=font_bold)
        draw.text((1350, 380), 'Rate', fill=0, font=font_bold)
        draw.text((1600, 380), 'Amount', fill=0, font=font_bold)
        draw.line([(100, 430), (1900, 430)], fill=0, width=2)

        # 2 items summing to 2000.00
        draw.text((100, 460), 'Servo Motor MG996R', fill=0, font=font_body)
        draw.text((1150, 460), '10', fill=0, font=font_body)
        draw.text((1350, 460), '100.00', fill=0, font=font_body)
        draw.text((1600, 460), '1000.00', fill=0, font=font_body)

        draw.text((100, 520), 'Stepper Driver A4988', fill=0, font=font_body)
        draw.text((1150, 520), '5', fill=0, font=font_body)
        draw.text((1350, 520), '200.00', fill=0, font=font_body)
        draw.text((1600, 520), '1000.00', fill=0, font=font_body)
        draw.line([(100, 580), (1900, 580)], fill=0, width=2)

        draw.text((1200, 620), 'Subtotal:', fill=0, font=font_bold)
        draw.text((1600, 620), '2000.00', fill=0, font=font_body)
        draw.text((1200, 670), 'GST 18%:', fill=0, font=font_body)
        draw.text((1600, 670), '360.00', fill=0, font=font_body)
        draw.line([(1200, 720), (1900, 720)], fill=0, width=2)
        # Erroneous printed total: 2999.00 instead of 2360.00!
        draw.text((1200, 750), 'Grand Total:', fill=0, font=font_title)
        draw.text((1600, 750), '2999.00', fill=0, font=font_title)

        buf = io.BytesIO()
        img.save(buf, format='PNG')

        response = self.client.post(
            "/api/imports/purchase/ocr",
            files={"file": ("math_err.png", io.BytesIO(buf.getvalue()), "image/png")}
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        meta = res["metadata"]

        # MATHEMATICAL INTEGRITY INVARIANT: Must NOT silently balance the total!
        self.assertTrue(meta["has_discrepancy"])
        self.assertEqual(meta["printed_grand_total"], 2999.0)
        self.assertEqual(meta["calculated_grand_total"], 2360.0)
        self.assertAlmostEqual(meta["discrepancy_amount"], 639.0, places=1)
        self.assertIn("financial_discrepancy", meta["uncertain_fields"])

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_8_interstate_igst_roundoff(self, mock_db):
        """Case 8: Interstate IGST with discount & negative round-off – testing Decimal precision."""
        mock_db.return_value = []
        font_title, font_bold, font_body = get_test_fonts()
        img = Image.new('L', (2000, 1400), color=255)
        draw = ImageDraw.Draw(img)

        draw.text((100, 80), 'INTERSTATE TAX INVOICE', fill=0, font=font_title)
        draw.text((100, 140), 'Supplier: Silicon Bay Semiconductors', fill=0, font=font_body)
        draw.text((100, 190), 'GSTIN: 29AAGCB2212P1ZR', fill=0, font=font_body)
        draw.text((100, 240), 'Invoice No: SB-9901', fill=0, font=font_body)
        draw.text((100, 290), 'Date: 01/10/2026', fill=0, font=font_body)

        draw.line([(100, 360), (1900, 360)], fill=0, width=2)
        draw.text((100, 380), 'Item Description', fill=0, font=font_bold)
        draw.text((1150, 380), 'Qty', fill=0, font=font_bold)
        draw.text((1350, 380), 'Rate', fill=0, font=font_bold)
        draw.text((1600, 380), 'Amount', fill=0, font=font_bold)
        draw.line([(100, 430), (1900, 430)], fill=0, width=2)

        draw.text((100, 460), 'STM32 Nucleo Board', fill=0, font=font_body)
        draw.text((1150, 460), '10', fill=0, font=font_body)
        draw.text((1350, 460), '1100.00', fill=0, font=font_body)
        draw.text((1600, 460), '11000.00', fill=0, font=font_body)
        draw.line([(100, 520), (1900, 520)], fill=0, width=2)

        draw.text((1200, 550), 'Subtotal:', fill=0, font=font_bold)
        draw.text((1600, 550), '11000.00', fill=0, font=font_body)
        draw.text((1200, 600), 'IGST 18%:', fill=0, font=font_body)
        draw.text((1600, 600), '1980.00', fill=0, font=font_body)
        draw.text((1200, 650), 'Discount:', fill=0, font=font_body)
        draw.text((1600, 650), '500.00', fill=0, font=font_body)
        draw.text((1200, 700), 'Round Off:', fill=0, font=font_body)
        draw.text((1600, 700), '-0.40', fill=0, font=font_body)
        draw.line([(1200, 740), (1900, 740)], fill=0, width=2)
        draw.text((1200, 770), 'Grand Total:', fill=0, font=font_title)
        draw.text((1600, 770), '12479.60', fill=0, font=font_title)

        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=95)

        response = self.client.post(
            "/api/imports/purchase/ocr",
            files={"file": ("interstate.jpg", io.BytesIO(buf.getvalue()), "image/jpeg")}
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        meta = res["metadata"]

        self.assertEqual(meta["igst"], 1980.0)
        self.assertEqual(meta["discount"], 500.0)
        self.assertEqual(meta["round_off"], -0.40)
        self.assertEqual(meta["printed_grand_total"], 12479.60)
        self.assertEqual(meta["calculated_grand_total"], 12479.60)
        self.assertFalse(meta["has_discrepancy"])

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_9_preserve_verbatim_descriptions(self, mock_db):
        """Case 9: Verify supplier invoice descriptions are never overwritten by inventory items."""
        # Mock database containing a similarly named component
        mock_db.return_value = [
            {
                "id": "comp-esp32-db",
                "name": "ESP32 DevKit",
                "category": "Microcontrollers",
                "total_stock": 25,
                "description": "Standard ESP32 Board"
            }
        ]
        font_title, font_bold, font_body = get_test_fonts()
        img = Image.new('L', (2000, 1200), color=255)
        draw = ImageDraw.Draw(img)

        draw.text((100, 80), 'TAX INVOICE', fill=0, font=font_title)
        draw.text((100, 140), 'Supplier: MicroSemi Hub', fill=0, font=font_body)
        draw.text((100, 190), 'GSTIN: 33AABCM9988P1ZZ', fill=0, font=font_body)
        draw.text((100, 240), 'Invoice No: MSH-2026', fill=0, font=font_body)
        draw.text((100, 290), 'Date: 10/08/2026', fill=0, font=font_body)

        draw.line([(100, 360), (1900, 360)], fill=0, width=2)
        draw.text((100, 380), 'Item Description', fill=0, font=font_bold)
        draw.text((1150, 380), 'Qty', fill=0, font=font_bold)
        draw.text((1350, 380), 'Rate', fill=0, font=font_bold)
        draw.text((1600, 380), 'Amount', fill=0, font=font_bold)
        draw.line([(100, 430), (1900, 430)], fill=0, width=2)

        # Verbatim supplier description with specifications
        draw.text((100, 460), 'ESP32-WROOM-32D 38PIN DEV BOARD', fill=0, font=font_body)
        draw.text((1150, 460), '5', fill=0, font=font_body)
        draw.text((1350, 460), '350.00', fill=0, font=font_body)
        draw.text((1600, 460), '1750.00', fill=0, font=font_body)
        draw.line([(100, 520), (1900, 520)], fill=0, width=2)

        draw.text((1200, 550), 'Grand Total:', fill=0, font=font_title)
        draw.text((1600, 550), '1750.00', fill=0, font=font_title)

        buf = io.BytesIO()
        img.save(buf, format='PNG')

        response = self.client.post(
            "/api/imports/purchase/ocr",
            files={"file": ("verbatim.png", io.BytesIO(buf.getvalue()), "image/png")}
        )
        self.assertEqual(response.status_code, 200)
        res = response.json()
        item = res["line_items"][0]

        # ZERO OVERWRITE INVARIANT: Verbatim supplier description must be preserved!
        self.assertIn("ESP32-WROOM-32D", item["original_item_name"])
        self.assertIn("ESP32-WROOM-32D", item["item_name"])
        # And matched component from catalog is kept separately as a suggestion
        if item.get("possible_match"):
            self.assertEqual(item["possible_match"]["name"], "ESP32 DevKit")

    @patch("app.api.routes.import_data.db_query")
    def test_benchmark_case_10_multipage_document(self, mock_db):
        """Case 10: Multi-page document aggregation and totals verification."""
        mock_db.return_value = []
        # Simulate multi-page document raw text directly
        raw_text_multipage = (
            "TAX INVOICE (Page 1 of 2)\n"
            "Supplier: Matrix Components Pvt Ltd\n"
            "GSTIN: 36AABCM4433R1ZS\n"
            "Invoice No: MAT-8899\n"
            "Date: 25/07/2026\n"
            "\n"
            "Line Items:\n"
            "Raspberry Pi 4 Model B 4GB 5 4200.00 21000.00\n"
            "Official 15W USB-C Power Supply 5 650.00 3250.00\n"
            "\n"
            "--- PAGE 2 ---\n"
            "TAX INVOICE (Page 2 of 2)\n"
            "Micro HDMI to HDMI Cable 5 250.00 1250.00\n"
            "Sandisk 32GB MicroSD Card 5 450.00 2250.00\n"
            "\n"
            "Subtotal: 27,750.00\n"
            "GST 18%: 4,995.00\n"
            "Grand Total: 32,745.00\n"
        )
        with patch("app.api.routes.import_data.perform_ocr_sync") as mock_ocr:
            mock_ocr.return_value = raw_text_multipage
            response = self.client.post(
                "/api/imports/purchase/ocr",
                files={"file": ("multipage.pdf", io.BytesIO(b"%PDF-1.4 dummy"), "application/pdf")}
            )
            self.assertEqual(response.status_code, 200)
            res = response.json()
            meta = res["metadata"]
            
            self.assertEqual(meta["supplier_name"], "Matrix Components Pvt Ltd")
            self.assertEqual(meta["supplier_gst"], "36AABCM4433R1ZS")
            self.assertEqual(meta["invoice_number"], "MAT-8899")
            self.assertEqual(len(res["line_items"]), 4)
            self.assertEqual(meta["printed_grand_total"], 32745.0)
            self.assertEqual(meta["calculated_grand_total"], 32745.0)
            self.assertFalse(meta["has_discrepancy"])

if __name__ == "__main__":
    unittest.main()
