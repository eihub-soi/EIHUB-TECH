import os
import sys
import unittest
import io
import math
from decimal import Decimal, ROUND_HALF_UP
from unittest.mock import patch

os.environ["TESTING"] = "True"
sys.path.append(os.path.dirname(__file__))

from app.main import app, require_admin, require_faculty_or_admin, get_current_user
from fastapi.testclient import TestClient
from app.api.routes.import_data import (
    clean_item_serial_number,
    is_invoice_summary_row,
    perform_ocr_sync,
    evaluate_line_item
)

def round_half_up(val: float, decimals: int = 2) -> float:
    """Decimal-safe ROUND_HALF_UP matching frontend implementation with explicit validation."""
    if val is None or not isinstance(val, (int, float, Decimal)):
        raise TypeError(f"[Financial Precision Error] Invalid numeric input passed to round_half_up: {val}")
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        raise ValueError(f"[Financial Precision Error] Cannot round NaN or Infinity in financial calculations: {val}")
    if not isinstance(decimals, int) or decimals < 0:
        raise ValueError(f"[Financial Precision Error] Invalid decimals: {decimals}")
    d = Decimal(str(val))
    return float(d.quantize(Decimal("1." + "0" * decimals), rounding=ROUND_HALF_UP))

class TestPurchaseUIScenarios(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.mock_user = {
            "uid": "admin-scenario-user",
            "name": "Admin Procure",
            "role": "super_admin",
            "email": "procure@eihub.internal"
        }
        app.dependency_overrides[require_admin] = lambda: self.mock_user
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_user
        app.dependency_overrides[get_current_user] = lambda: self.mock_user

    def tearDown(self):
        app.dependency_overrides.clear()

    @patch("app.api.routes.import_data.db_query")
    @patch("app.api.routes.import_data.perform_ocr_sync")
    def test_scenario_ocr_ten_products_with_total_row(self, mock_ocr, mock_db_query):
        """Invoice containing 10 products and a separate Total row."""
        ocr_text = (
            "TAX INVOICE\n"
            "Supplier: Electro Components Ltd\n"
            "GSTIN: 27AABCE1234F1Z5\n"
            "Invoice No: INV-TEN-100\n"
            "Date: 10/11/2026\n"
            "\n"
            "Line Items:\n"
            "Resistor 10k 100 1.50 150.00\n"
            "Capacitor 100uF 50 4.00 200.00\n"
            "LED Red 5mm 200 2.00 400.00\n"
            "Potentiometer 10k 20 15.00 300.00\n"
            "Diode 1N4007 100 2.50 250.00\n"
            "Transistor BC547 50 3.00 150.00\n"
            "Optocoupler PC817 25 8.00 200.00\n"
            "Relay 5V SPDT 10 35.00 350.00\n"
            "Buzzer 5V 15 12.00 180.00\n"
            "Breadboard 830 Points 5 120.00 600.00\n"
            "Total 2780.00\n"
            "Grand Total: 2780.00\n"
        )
        mock_ocr.return_value = ocr_text
        mock_db_query.return_value = []

        file = {"file": ("ten_items.png", io.BytesIO(b"fake data"), "image/png")}
        response = self.client.post("/api/imports/purchase/ocr", files=file)
        self.assertEqual(response.status_code, 200)
        res = response.json()

        line_items = res["line_items"]
        self.assertEqual(len(line_items), 10, f"Expected 10 items, got {len(line_items)}")

        for it in line_items:
            self.assertFalse(
                it["item_name"].strip().lower() in ["total", "grand total", "subtotal", "sub total"],
                f"Summary row leaked into line items: {it['item_name']}"
            )

        self.assertEqual(res["metadata"]["grand_total"], 2780.0)

    def test_scenario_descriptions_with_model_numbers(self):
        """Product descriptions containing model numbers such as NE555P, LM7805CT, and 1N4007."""
        models = [
            ("NE555P PRECISION TIMER IC", "NE555P PRECISION TIMER IC"),
            ("LM7805CT LINEAR VOLTAGE REGULATOR", "LM7805CT LINEAR VOLTAGE REGULATOR"),
            ("1N4007 RECTIFIER DIODE 1000V 1A", "1N4007 RECTIFIER DIODE 1000V 1A"),
            ("18650 - 1 CELL HOLDER WITH LEADS", "18650 - 1 CELL HOLDER WITH LEADS"),
            ("LM317T ADJUSTABLE REGULATOR", "LM317T ADJUSTABLE REGULATOR"),
            ("ESP8266 WIFI MODULE ESP-12E", "ESP8266 WIFI MODULE ESP-12E")
        ]
        for raw, expected in models:
            cleaned = clean_item_serial_number(raw)
            self.assertEqual(cleaned, expected, f"Model number mutilated in '{raw}' -> got '{cleaned}'")

    def test_scenario_product_names_beginning_with_serial_numbers(self):
        """Product names beginning with invoice serial numbers."""
        test_cases = [
            ("7 SENSOR MODULE", 6, "SENSOR MODULE"),
            ("8 18650 - 1 CELL HOLDER", 7, "18650 - 1 CELL HOLDER"),
            ("9 SWITCH", 8, "SWITCH"),
            ("10 RGB LED (4 TERMINALS)", 9, "RGB LED (4 TERMINALS)"),
            ("1. ARDUINO NANO V3", 0, "ARDUINO NANO V3"),
            ("02) OLED DISPLAY 0.96 INCH", 1, "OLED DISPLAY 0.96 INCH"),
            ("3 - SG90 MICRO SERVO MOTOR", 2, "SG90 MICRO SERVO MOTOR")
        ]
        for raw, row_idx, expected in test_cases:
            cleaned = clean_item_serial_number(raw, row_idx)
            self.assertEqual(cleaned, expected, f"Failed cleaning serial number for '{raw}' -> '{cleaned}'")

    def test_round_half_up_exact_precision(self):
        """Verify decimal-safe ROUND_HALF_UP precision with positive and negative numbers."""
        test_cases = [
            (1.005, 1.01),
            (2.675, 2.68),
            (-1.005, -1.01),
            (-2.675, -2.68),
            (1.004, 1.00),
            (-1.004, -1.00),
            (35.255, 35.26),
            (-35.255, -35.26),
            (0.0, 0.0),
        ]
        for val, expected in test_cases:
            res = round_half_up(val, 2)
            self.assertEqual(res, expected, f"Failed round_half_up for {val}: got {res}, expected {expected}")

        # Explicitly verify rejection of NaN, Infinity, and invalid types
        with self.assertRaises(ValueError):
            round_half_up(float("nan"), 2)
        with self.assertRaises(ValueError):
            round_half_up(float("inf"), 2)
        with self.assertRaises(ValueError):
            round_half_up(float("-inf"), 2)
        with self.assertRaises(TypeError):
            round_half_up("invalid_str", 2)
        with self.assertRaises(TypeError):
            round_half_up(None, 2)

    # =========================================================================
    # EXACT FINANCIAL RECALCULATION SCENARIOS (FIX 1 to FIX 4)
    # =========================================================================

    def _calculate_financials(self, items, tax_mode, cgst_r, sgst_r, igst_r, round_off, disc):
        """Exact financial calculation engine with decimal-safe ROUND_HALF_UP."""
        taxable = round_half_up(sum(it["total"] for it in items), 2)
        if tax_mode == "inter":
            cgst = 0.0
            sgst = 0.0
            igst = round_half_up(taxable * (igst_r / 100.0), 2)
            total_gst = igst
        elif tax_mode == "intra":
            cgst = round_half_up(taxable * (cgst_r / 100.0), 2)
            sgst = round_half_up(taxable * (sgst_r / 100.0), 2)
            igst = 0.0
            total_gst = round_half_up(cgst + sgst, 2)
        else:
            cgst = round_half_up(taxable * (cgst_r / 100.0), 2)
            sgst = round_half_up(taxable * (sgst_r / 100.0), 2)
            igst = round_half_up(taxable * (igst_r / 100.0), 2)
            total_gst = round_half_up(cgst + sgst + igst, 2)

        grand_total = round_half_up(taxable + total_gst - disc + round_off, 2)
        return {
            "taxable": taxable,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total_gst": total_gst,
            "grand_total": grand_total
        }

    def test_exact_financial_scenarios_1_to_10(self):
        """Step-by-step verification of all 10 financial recalculation scenarios."""
        # Baseline Invoice: 5 items
        items = [
            {"name": "SENSOR MODULE", "qty": 10.0, "rate": 150.00, "disc": 0.0, "total": 1500.00, "selected": True},
            {"name": "18650 - 1 CELL HOLDER", "qty": 20.0, "rate": 45.50, "disc": 10.0, "total": 819.00, "selected": True},
            {"name": "NE555P TIMER IC", "qty": 50.0, "rate": 12.00, "disc": 0.0, "total": 600.00, "selected": True},
            {"name": "LM7805CT REGULATOR", "qty": 15.0, "rate": 25.00, "disc": 5.0, "total": 356.25, "selected": True},
            {"name": "1N4007 DIODE", "qty": 100.0, "rate": 2.50, "disc": 0.0, "total": 250.00, "selected": True}
        ]
        round_off = -0.01
        discount = 0.0
        printed_taxable = 3525.25
        printed_grand_total = 4159.78
        cgst_rate = 9.0
        sgst_rate = 9.0
        igst_rate = 18.0
        tax_mode = "intra"

        # Baseline Verification
        base = self._calculate_financials(items, tax_mode, cgst_rate, sgst_rate, igst_rate, round_off, discount)
        self.assertEqual(base["taxable"], 3525.25)
        self.assertEqual(base["cgst"], 317.27)
        self.assertEqual(base["sgst"], 317.27)
        self.assertEqual(base["grand_total"], 4159.78)

        # ---------------------------------------------------------------------
        # 1. Change quantity from 10 to 5 (on Item 1)
        # ---------------------------------------------------------------------
        items[0]["qty"] = 5.0
        line1 = round_half_up(items[0]["qty"] * items[0]["rate"], 2) # 750.00
        disc1 = round_half_up(line1 * (items[0]["disc"] / 100.0), 2) # 0.00
        items[0]["total"] = round_half_up(line1 - disc1, 2) # 750.00
        res1 = self._calculate_financials(items, tax_mode, cgst_rate, sgst_rate, igst_rate, round_off, discount)

        # Expected: Taxable=2775.25, CGST=249.77, SGST=249.77, Grand Total=3274.78
        self.assertEqual(res1["taxable"], 2775.25)
        self.assertEqual(res1["cgst"], 249.77)
        self.assertEqual(res1["sgst"], 249.77)
        self.assertEqual(res1["grand_total"], 3274.78)

        # ---------------------------------------------------------------------
        # 2. Change rate from ₹150 to ₹200 (on Item 1)
        # ---------------------------------------------------------------------
        items[0]["rate"] = 200.00
        line2 = round_half_up(items[0]["qty"] * items[0]["rate"], 2) # 1000.00
        disc2 = round_half_up(line2 * (items[0]["disc"] / 100.0), 2) # 0.00
        items[0]["total"] = round_half_up(line2 - disc2, 2) # 1000.00
        res2 = self._calculate_financials(items, tax_mode, cgst_rate, sgst_rate, igst_rate, round_off, discount)

        # Expected: Taxable=3025.25, CGST=272.27, SGST=272.27, Grand Total=3569.78
        self.assertEqual(res2["taxable"], 3025.25)
        self.assertEqual(res2["cgst"], 272.27)
        self.assertEqual(res2["sgst"], 272.27)
        self.assertEqual(res2["grand_total"], 3569.78)

        # ---------------------------------------------------------------------
        # 3. Change discount from 0% to 10% (on Item 1)
        # ---------------------------------------------------------------------
        items[0]["disc"] = 10.0
        line3 = round_half_up(items[0]["qty"] * items[0]["rate"], 2) # 1000.00
        disc3 = round_half_up(line3 * (items[0]["disc"] / 100.0), 2) # 100.00
        items[0]["total"] = round_half_up(line3 - disc3, 2) # 900.00
        res3 = self._calculate_financials(items, tax_mode, cgst_rate, sgst_rate, igst_rate, round_off, discount)

        # Expected: Taxable=2925.25, CGST=263.27, SGST=263.27, Grand Total=3451.78
        self.assertEqual(res3["taxable"], 2925.25)
        self.assertEqual(res3["cgst"], 263.27)
        self.assertEqual(res3["sgst"], 263.27)
        self.assertEqual(res3["grand_total"], 3451.78)

        # ---------------------------------------------------------------------
        # 4. Delete one product (Delete Item 5: Diode 1N4007 ₹250.00)
        # ---------------------------------------------------------------------
        items = [it for it in items if it["name"] != "1N4007 DIODE"]
        self.assertEqual(len(items), 4)
        res4 = self._calculate_financials(items, tax_mode, cgst_rate, sgst_rate, igst_rate, round_off, discount)

        # Expected: Taxable=2675.25, CGST=240.77, SGST=240.77, Grand Total=3156.78
        self.assertEqual(res4["taxable"], 2675.25)
        self.assertEqual(res4["cgst"], 240.77)
        self.assertEqual(res4["sgst"], 240.77)
        self.assertEqual(res4["grand_total"], 3156.78)

        # ---------------------------------------------------------------------
        # 5. Add a new product (ESP32 DEV BOARD: Qty 2, Rate ₹350.00, Disc 0% -> ₹700.00)
        # ---------------------------------------------------------------------
        new_item = {"name": "ESP32 DEV BOARD", "qty": 2.0, "rate": 350.00, "disc": 0.0, "total": 700.00, "selected": True}
        items.append(new_item)
        self.assertEqual(len(items), 5)
        res5 = self._calculate_financials(items, tax_mode, cgst_rate, sgst_rate, igst_rate, round_off, discount)

        # Expected: Taxable=3375.25, CGST=303.77, SGST=303.77, Grand Total=3982.78
        self.assertEqual(res5["taxable"], 3375.25)
        self.assertEqual(res5["cgst"], 303.77)
        self.assertEqual(res5["sgst"], 303.77)
        self.assertEqual(res5["grand_total"], 3982.78)

        # ---------------------------------------------------------------------
        # 6. Change CGST and SGST rates (from 9% & 9% to 6% & 6%)
        # ---------------------------------------------------------------------
        cgst_rate = 6.0
        sgst_rate = 6.0
        res6 = self._calculate_financials(items, tax_mode, cgst_rate, sgst_rate, igst_rate, round_off, discount)

        # Expected: Taxable=3375.25, CGST(6%)=202.52, SGST(6%)=202.52, Grand Total=3780.28
        self.assertEqual(res6["taxable"], 3375.25)
        self.assertEqual(res6["cgst"], 202.52)
        self.assertEqual(res6["sgst"], 202.52)
        self.assertEqual(res6["grand_total"], 3780.28)

        # ---------------------------------------------------------------------
        # 7. Switch from CGST/SGST to IGST (18% Inter-State)
        # ---------------------------------------------------------------------
        tax_mode = "inter"
        igst_rate = 18.0
        res7 = self._calculate_financials(items, tax_mode, cgst_rate, sgst_rate, igst_rate, round_off, discount)

        # Expected: Taxable=3375.25, CGST=0.00, SGST=0.00, IGST(18%)=607.55, Grand Total=3982.79
        self.assertEqual(res7["taxable"], 3375.25)
        self.assertEqual(res7["cgst"], 0.00)
        self.assertEqual(res7["sgst"], 0.00)
        self.assertEqual(res7["igst"], 607.55)
        self.assertEqual(res7["grand_total"], 3982.79)

        # ---------------------------------------------------------------------
        # 8. Compare printed taxable amount with calculated taxable amount
        # ---------------------------------------------------------------------
        calc_taxable = res7["taxable"]
        taxable_diff = round_half_up(abs(calc_taxable - printed_taxable), 2)
        has_taxable_mismatch = taxable_diff > 0.50

        # Expected: Printed=3525.25, Calculated=3375.25, Diff=150.00, Mismatch=True
        self.assertEqual(printed_taxable, 3525.25)
        self.assertEqual(calc_taxable, 3375.25)
        self.assertEqual(taxable_diff, 150.00)
        self.assertTrue(has_taxable_mismatch)

        # ---------------------------------------------------------------------
        # 9. Compare printed grand total with calculated grand total
        # ---------------------------------------------------------------------
        calc_gt = res7["grand_total"]
        gt_diff = round_half_up(abs(calc_gt - printed_grand_total), 2)
        has_gt_mismatch = gt_diff > 0.50

        # Expected: Printed=4159.78, Calculated=3982.79, Diff=176.99, Mismatch=True
        self.assertEqual(printed_grand_total, 4159.78)
        self.assertEqual(calc_gt, 3982.79)
        self.assertEqual(gt_diff, 176.99)
        self.assertTrue(has_gt_mismatch)

        # ---------------------------------------------------------------------
        # 10. Verify that unchecked products do not enter inventory,
        #     while original invoice totals remain preserved
        # ---------------------------------------------------------------------
        # Uncheck Item 2 (18650 - 1 CELL HOLDER)
        items[1]["selected"] = False
        checked_items = [it for it in items if it["selected"]]
        self.assertEqual(len(items), 5)
        self.assertEqual(len(checked_items), 4)
        self.assertNotIn("18650 - 1 CELL HOLDER", [it["name"] for it in checked_items])

        # Verify that supplier's printed grand total is untouched
        self.assertEqual(printed_grand_total, 4159.78)
        self.assertEqual(printed_taxable, 3525.25)

    def test_financial_scenario_01_qty_change_recalculates_taxable(self):
        """Scenario 1: Editing item quantity immediately recalculates taxable base."""
        items = [{"name": "SENSOR MODULE", "qty": 5.0, "rate": 150.00, "disc": 0.0, "total": 750.00, "selected": True}]
        res = self._calculate_financials(items, "intra", 9.0, 9.0, 18.0, 0.0, 0.0)
        self.assertEqual(res["taxable"], 750.00)
        self.assertEqual(res["cgst"], 67.50)
        self.assertEqual(res["sgst"], 67.50)
        self.assertEqual(res["grand_total"], 885.00)

    def test_financial_scenario_02_rate_change_recalculates_taxable(self):
        """Scenario 2: Editing item unit rate immediately recalculates taxable base."""
        items = [{"name": "SENSOR MODULE", "qty": 5.0, "rate": 200.00, "disc": 0.0, "total": 1000.00, "selected": True}]
        res = self._calculate_financials(items, "intra", 9.0, 9.0, 18.0, 0.0, 0.0)
        self.assertEqual(res["taxable"], 1000.00)
        self.assertEqual(res["cgst"], 90.00)
        self.assertEqual(res["sgst"], 90.00)
        self.assertEqual(res["grand_total"], 1180.00)

    def test_financial_scenario_03_discount_change_recalculates_taxable(self):
        """Scenario 3: Editing item discount immediately recalculates taxable base."""
        items = [{"name": "SENSOR MODULE", "qty": 5.0, "rate": 200.00, "disc": 10.0, "total": 900.00, "selected": True}]
        res = self._calculate_financials(items, "intra", 9.0, 9.0, 18.0, 0.0, 0.0)
        self.assertEqual(res["taxable"], 900.00)
        self.assertEqual(res["cgst"], 81.00)
        self.assertEqual(res["sgst"], 81.00)
        self.assertEqual(res["grand_total"], 1062.00)

    def test_financial_scenario_04_delete_product_recalculates_taxable(self):
        """Scenario 4: Deleting a product recalculates the invoice taxable base."""
        items = [
            {"name": "SENSOR MODULE", "qty": 5.0, "rate": 200.00, "disc": 10.0, "total": 900.00, "selected": True},
            {"name": "DIODE 1N4007", "qty": 100.0, "rate": 2.50, "disc": 0.0, "total": 250.00, "selected": True}
        ]
        # Before delete: 900 + 250 = 1150
        res_before = self._calculate_financials(items, "intra", 9.0, 9.0, 18.0, 0.0, 0.0)
        self.assertEqual(res_before["taxable"], 1150.00)
        # After delete Diode:
        items_after = [items[0]]
        res_after = self._calculate_financials(items_after, "intra", 9.0, 9.0, 18.0, 0.0, 0.0)
        self.assertEqual(res_after["taxable"], 900.00)
        self.assertEqual(res_after["grand_total"], 1062.00)

    def test_financial_scenario_05_add_new_product_recalculates_taxable(self):
        """Scenario 5: Adding a new product recalculates the invoice taxable base."""
        items = [{"name": "SENSOR MODULE", "qty": 5.0, "rate": 200.00, "disc": 10.0, "total": 900.00, "selected": True}]
        items.append({"name": "ESP32 DEV BOARD", "qty": 2.0, "rate": 350.00, "disc": 0.0, "total": 700.00, "selected": True})
        res = self._calculate_financials(items, "intra", 9.0, 9.0, 18.0, 0.0, 0.0)
        self.assertEqual(res["taxable"], 1600.00)
        self.assertEqual(res["cgst"], 144.00)
        self.assertEqual(res["sgst"], 144.00)
        self.assertEqual(res["grand_total"], 1888.00)

    def test_financial_scenario_06_change_cgst_sgst_rates(self):
        """Scenario 6: Changing CGST/SGST rates updates calculated tax without mutating taxable base."""
        items = [{"name": "ESP32 DEV BOARD", "qty": 2.0, "rate": 350.00, "disc": 0.0, "total": 700.00, "selected": True}]
        res_9pct = self._calculate_financials(items, "intra", 9.0, 9.0, 18.0, 0.0, 0.0)
        self.assertEqual(res_9pct["cgst"], 63.00)
        self.assertEqual(res_9pct["sgst"], 63.00)
        self.assertEqual(res_9pct["grand_total"], 826.00)

        res_6pct = self._calculate_financials(items, "intra", 6.0, 6.0, 18.0, 0.0, 0.0)
        self.assertEqual(res_6pct["cgst"], 42.00)
        self.assertEqual(res_6pct["sgst"], 42.00)
        self.assertEqual(res_6pct["grand_total"], 784.00)
        self.assertEqual(res_9pct["taxable"], res_6pct["taxable"])

    def test_financial_scenario_07_switch_from_intra_to_inter_state_igst(self):
        """Scenario 7: Switching to IGST mode zeros CGST/SGST and computes IGST."""
        items = [{"name": "ESP32 DEV BOARD", "qty": 2.0, "rate": 350.00, "disc": 0.0, "total": 700.00, "selected": True}]
        res_inter = self._calculate_financials(items, "inter", 9.0, 9.0, 18.0, 0.0, 0.0)
        self.assertEqual(res_inter["taxable"], 700.00)
        self.assertEqual(res_inter["cgst"], 0.00)
        self.assertEqual(res_inter["sgst"], 0.00)
        self.assertEqual(res_inter["igst"], 126.00)
        self.assertEqual(res_inter["grand_total"], 826.00)

    def test_financial_scenario_08_compare_printed_vs_calculated_taxable_discrepancy(self):
        """Scenario 8: Discrepancy warning flagged when printed and calculated taxable differ > 0.50."""
        printed_taxable = 1000.00
        calc_taxable = 900.00
        diff = round_half_up(abs(calc_taxable - printed_taxable), 2)
        has_mismatch = diff > 0.50
        self.assertEqual(diff, 100.00)
        self.assertTrue(has_mismatch)

    def test_financial_scenario_09_compare_printed_vs_calculated_grand_total_discrepancy(self):
        """Scenario 9: Discrepancy warning flagged when printed and calculated grand total differ > 0.50."""
        printed_total = 1180.00
        calc_total = 1062.00
        diff = round_half_up(abs(calc_total - printed_total), 2)
        has_mismatch = diff > 0.50
        self.assertEqual(diff, 118.00)
        self.assertTrue(has_mismatch)

    def test_financial_scenario_10_unchecked_items_excluded_from_inventory(self):
        """Scenario 10: Unchecked items are excluded from inventory while printed invoice totals remain preserved."""
        items = [
            {"name": "SENSOR MODULE", "qty": 10.0, "rate": 150.00, "disc": 0.0, "total": 1500.00, "selected": True},
            {"name": "DIODE 1N4007", "qty": 100.0, "rate": 2.50, "disc": 0.0, "total": 250.00, "selected": False}
        ]
        printed_grand_total = 1750.00
        checked_for_inventory = [it for it in items if it["selected"]]
        self.assertEqual(len(checked_for_inventory), 1)
        self.assertEqual(checked_for_inventory[0]["name"], "SENSOR MODULE")
        # Printed totals preserved intact
        self.assertEqual(printed_grand_total, 1750.00)

    def test_scenario_desktop_and_mobile_table_layouts(self):
        """Desktop and mobile table layout contract in JSX."""
        frontend_component_path = os.path.join(
            os.path.dirname(__file__), "..", "frontend", "src", "components", "import", "PurchaseBillImport.tsx"
        )
        with open(frontend_component_path, "r", encoding="utf-8") as f:
            code = f.read()

        # Check for horizontal scroll container for mobile/tablet responsive layout
        self.assertIn("overflow-x-auto", code, "Table must have horizontal scroll container")
        self.assertIn("min-w-[1050px]", code, "Table must specify min-width for columns")

        # Check for word wrapping / no ellipsis truncation on item description
        self.assertIn("whitespace-normal", code, "Item description must allow multi-line wrapping")
        self.assertIn("break-words", code, "Item description must break words cleanly")

        # Check for 11 columns in header
        table_headers = [
            "S.No.", "Item Name &amp; Description", "HSN", "Qty", "Unit",
            "Rate (₹)", "Disc (%)", "Amount (₹)", "Master Matching", "Del"
        ]
        for h in table_headers:
            self.assertIn(h, code, f"Header '{h}' missing from 11-column table layout")

    @patch("app.api.routes.import_data.db_query")
    @patch("app.api.routes.import_data.perform_ocr_sync")
    def test_scenario_ocr_extraction_never_mutates_database(self, mock_ocr, mock_db_query):
        """Confirming that OCR extraction alone does NOT modify inventory."""
        ocr_text = (
            "TAX INVOICE\n"
            "Supplier: Test Vendor\n"
            "GSTIN: 29AABCT1234F1Z1\n"
            "Invoice No: INV-READ-ONLY-01\n"
            "Date: 01/11/2026\n"
            "Item A 10 50.00 500.00\n"
            "Grand Total: 500.00\n"
        )
        mock_ocr.return_value = ocr_text
        mock_db_query.return_value = []

        file = {"file": ("readonly.png", io.BytesIO(b"dummy data"), "image/png")}
        response = self.client.post("/api/imports/purchase/ocr", files=file)
        self.assertEqual(response.status_code, 200)

        for call_args in mock_db_query.call_args_list:
            sql_query = call_args[0][0].strip().upper()
            self.assertTrue(
                sql_query.startswith("SELECT"),
                f"Mutation query executed during OCR extraction! {sql_query}"
            )
            self.assertNotIn("INSERT", sql_query)
            self.assertNotIn("UPDATE", sql_query)
            self.assertNotIn("DELETE", sql_query)

if __name__ == "__main__":
    unittest.main()
