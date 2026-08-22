import unittest
import asyncio
import io
import sys
import os
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

# Add backend to path
sys.path.append(os.path.dirname(__file__))

from app.main import app, require_faculty_or_admin, get_current_user

class TestPurchaseOCR(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.mock_user = {
            "uid": "test-admin-uid",
            "name": "Test Admin",
            "role": "super_admin",
            "email": "admin@test.com"
        }
        # Override requirement dependencies globally for testing
        from app.main import require_admin
        app.dependency_overrides[require_admin] = lambda: self.mock_user
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_user
        app.dependency_overrides[get_current_user] = lambda: self.mock_user
        
    def tearDown(self):
        app.dependency_overrides.clear()

    @patch("app.api.routes.import_data.db_query")
    @patch("app.api.routes.import_data.perform_ocr_sync")
    def test_purchase_ocr_endpoint(self, mock_ocr, mock_db_query):
        # Mock OCR output text simulating an invoice
        mock_ocr.return_value = (
            "TAX INVOICE\n"
            "Supplier: ABC Electronics Ltd\n"
            "GSTIN: 33ABCDE1234F1Z5\n"
            "Invoice No: INV-2026-9876\n"
            "Date: 21/08/2026\n"
            "\n"
            "Line Items:\n"
            "Arduino Uno Board 10 450.00 4500.00\n"
            "arduino uno board 5 450.00 2250.00\n" # Duplicate in invoice
            "ESP32 DevKit 5 350.00 1750.00\n"
            "Courier Charges 1 120.00 120.00\n" # Excluded non-component item
            "\n"
            "Subtotal: 8,500.00\n"
            "GST: 1,530.00\n"
            "Grand Total: 10,030.00\n"
        )
        
        # Mock empty DB to represent all components as NEW
        mock_db_query.return_value = []
        
        file = {"file": ("invoice.png", io.BytesIO(b"dummy image data"), "image/png")}
        response = self.client.post("/api/imports/purchase/ocr", files=file)
        
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertTrue(res_json["success"])
        
        # Check metadata extraction
        meta = res_json["metadata"]
        self.assertEqual(meta["supplier_name"], "ABC Electronics Ltd")
        self.assertEqual(meta["supplier_gst"], "33ABCDE1234F1Z5")
        self.assertEqual(meta["invoice_number"], "INV-2026-9876")
        self.assertEqual(meta["invoice_date"], "21/08/2026")
        self.assertEqual(meta["grand_total"], 10030.0)
        self.assertEqual(meta["subtotal"], 8500.0)
        
        # Check line items and duplicate merging (15 total Arduino Uno)
        line_items = res_json["line_items"]
        self.assertEqual(len(line_items), 2) # Arduino Uno merged, ESP32 DevKit
        
        arduino_item = next(item for item in line_items if item["item_name"].lower() == "arduino uno board")
        self.assertEqual(arduino_item["quantity"], 15)
        self.assertEqual(arduino_item["total"], 6750.0)
        self.assertEqual(arduino_item["status"], "✓ VERIFIED NEW")
        
        # Check auto-excluded courier charge
        excluded = res_json["excluded_items"]
        self.assertEqual(len(excluded), 1)
        self.assertEqual(excluded[0]["item_name"], "Courier Charges")

    @patch("app.api.routes.import_data.db_query")
    def test_purchase_verify_endpoint(self, mock_db_query):
        # Mock database containing Arduino Uno
        mock_db_query.return_value = [
            {
                "id": "existing-arduino-uuid",
                "name": "Arduino Uno Board",
                "category": "Microcontrollers",
                "description": "Original Arduino Board",
                "total_stock": 20
            }
        ]
        
        payload = {
            "metadata": {
                "supplier_name": "ABC Electronics",
                "invoice_number": "INV-102"
            },
            "line_items": [
                {
                    "item_name": "Arduino Uno Board",
                    "quantity": 10,
                    "unit_price": 450.0,
                    "category": "Microcontrollers"
                },
                {
                    "item_name": "Raspberry Pi 4",
                    "quantity": 5,
                    "unit_price": 3200.0,
                    "category": "Single Board Computers"
                }
            ]
        }
        
        response = self.client.post("/api/imports/purchase/verify", json=payload)
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        
        # Verify component matched classifications and stock adjustments
        items = res_json["line_items"]
        self.assertEqual(len(items), 2)
        
        arduino = next(i for i in items if i["item_name"] == "Arduino Uno Board")
        self.assertEqual(arduino["status"], "✓ VERIFIED EXISTING")
        self.assertEqual(arduino["old_stock"], 20)
        self.assertEqual(arduino["new_stock"], 30)
        
        pi = next(i for i in items if i["item_name"] == "Raspberry Pi 4")
        self.assertEqual(pi["status"], "✓ VERIFIED NEW")
        self.assertEqual(pi["old_stock"], 0)
        self.assertEqual(pi["new_stock"], 5)

    @patch("app.api.routes.import_data.db_query")
    @patch("app.api.routes.import_data.db_batch")
    @patch("app.api.routes.import_data.log_activity")
    def test_purchase_confirm_endpoint(self, mock_log, mock_batch, mock_db_query):
        # Mock DB select returning stock levels for matching component
        mock_db_query.return_value = [
            {
                "id": "existing-uuid-999",
                "name": "Arduino Uno Board",
                "category": "Microcontrollers",
                "total_stock": 10,
                "available_stock": 8
            }
        ]
        
        payload = {
            "metadata": {
                "supplier_name": "ABC Electronics",
                "invoice_number": "INV-2026-9876",
                "grand_total": 10030.0,
                "po_number": "PO-12345"
            },
            "line_items": [
                {
                    "item_name": "Arduino Uno Board",
                    "quantity": 5,
                    "unit_price": 450.0,
                    "category": "Microcontrollers"
                },
                {
                    "item_name": "New Sensor Module",
                    "quantity": 10,
                    "unit_price": 120.0,
                    "category": "Sensors"
                }
            ]
        }
        
        response = self.client.post("/api/imports/purchase/confirm", json=payload)
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertTrue(res_json["success"])
        
        # Verify batched SQL executions (1 Component Update, 1 Component Insert, 2 Purchase Orders Inserts)
        self.assertTrue(mock_batch.called)
        statements = mock_batch.call_args[0][0]
        self.assertEqual(len(statements), 4)
        
        # Find update stock query
        update_comp_stmt = next(s for s in statements if "UPDATE components" in s.sql)
        # Verify totals incremented: 10 old + 5 new = 15 total, 8 old + 5 new = 13 available
        self.assertEqual(update_comp_stmt.args[0], 15) # new total_stock
        self.assertEqual(update_comp_stmt.args[1], 13) # new available_stock
        
        # Find inserts purchase orders queries
        po_inserts = [s for s in statements if "INSERT INTO purchase_orders" in s.sql]
        self.assertEqual(len(po_inserts), 2)
        
        # Verify invoice reference and PO reference mappings are saved
        self.assertEqual(po_inserts[0].args[1], "PO-12345")
        self.assertEqual(po_inserts[0].args[11], "INV-2026-9876")

    def test_parse_ocr_coordinates(self):
        from app.api.routes.import_data import parse_ocr_coordinates
        
        # Construct raw coordinate mock
        raw_data = {
            'text': ["Description", "Qty", "Rate", "Amount", "Arduino", "Uno", "10", "450.00", "4,500.00"],
            'left': [100, 400, 500, 600, 100, 160, 400, 500, 600],
            'top': [100, 100, 100, 100, 150, 150, 150, 150, 150],
            'width': [80, 20, 30, 40, 50, 30, 15, 40, 60],
            'height': [15, 15, 15, 15, 12, 12, 12, 12, 12],
            'conf': [95.0] * 9
        }
        
        parsed = parse_ocr_coordinates(raw_data)
        self.assertTrue(parsed['header_found'])
        
        raw_rows = parsed['raw_rows']
        self.assertEqual(len(raw_rows), 1)
        
        row = raw_rows[0]
        self.assertEqual(row['item_name'], "Arduino Uno")
        self.assertEqual(row['quantity'], 10)
        self.assertEqual(row['unit_price'], 450.0)
        self.assertEqual(row['total'], 4500.0)

    def test_determine_category(self):
        from app.api.routes.import_data import determine_category
        
        # Priority 1: Invoice category
        self.assertEqual(determine_category("Some Component", "Sensors", "Microcontrollers"), "Sensors")
        
        # Priority 2: Existing DB category
        self.assertEqual(determine_category("Some Component", "Electronics", "Sensors"), "Sensors")
        self.assertEqual(determine_category("Some Component", "", "Sensors"), "Sensors")
        
        # Priority 3: Known mappings
        self.assertEqual(determine_category("Arduino Board R3", "Electronics", ""), "Microcontrollers")
        self.assertEqual(determine_category("HC-SR04 Sensor", "", "Electronics"), "Sensors")
        
        # Priority 4: Selection required
        self.assertEqual(determine_category("Unknown Widget", "Electronics", "Select Category"), "Select Category")

    def test_fuzzy_match_recommendations(self):
        from app.api.routes.import_data import evaluate_line_item, normalize_name
        
        comp_map = {
            normalize_name("Arduino Uno Board"): {
                "id": "db-arduino-id",
                "name": "Arduino Uno Board",
                "category": "Microcontrollers",
                "total_stock": 10
            }
        }
        
        # Test Case 1: Exact Match
        item1 = {
            "item_name": "arduino uno board",
            "quantity": 5,
            "unit_price": 450.0,
            "total": 2250.0,
            "category": "Electronics",
            "confidence_score": 90.0
        }
        eval1 = asyncio.run(evaluate_line_item(item1, comp_map))
        self.assertEqual(eval1["status"], "✓ VERIFIED EXISTING")
        self.assertEqual(eval1["existing_id"], "db-arduino-id")
        
        # Test Case 2: Fuzzy possible match (Arduino Uno Board V3 vs Arduino Uno Board)
        item2 = {
            "item_name": "Arduino Uno Board V3",
            "quantity": 5,
            "unit_price": 450.0,
            "total": 2250.0,
            "category": "Electronics",
            "confidence_score": 90.0
        }
        eval2 = asyncio.run(evaluate_line_item(item2, comp_map))
        self.assertEqual(eval2["status"], "⚠ POSSIBLE MATCH")
        self.assertIsNotNone(eval2["possible_match"])
        self.assertEqual(eval2["possible_match"]["name"], "Arduino Uno Board")
        
        # Test Case 3: Fuzzy match resolved by accepting as new
        item3 = {
            "item_name": "Arduino Uno Board V3",
            "quantity": 5,
            "unit_price": 450.0,
            "total": 2250.0,
            "category": "Electronics",
            "confidence_score": 90.0,
            "accepted_as_new": True
        }
        eval3 = asyncio.run(evaluate_line_item(item3, comp_map))
        self.assertEqual(eval3["status"], "✓ VERIFIED NEW")
        self.assertIsNone(eval3["possible_match"])

    def test_purchase_ocr_access_denied_for_admin_and_faculty(self):
        # Temporarily mock user as admin role
        self.mock_user["role"] = "admin"
        file = {"file": ("invoice.png", io.BytesIO(b"dummy image data"), "image/png")}
        response = self.client.post("/api/imports/purchase/ocr", files=file)
        self.assertEqual(response.status_code, 403)
        self.assertIn("Access Denied", response.json()["detail"])
        
        # Verify endpoint denies faculty
        self.mock_user["role"] = "faculty"
        response = self.client.post("/api/imports/purchase/ocr", files=file)
        self.assertEqual(response.status_code, 403)
        self.assertIn("Access Denied", response.json()["detail"])

if __name__ == "__main__":
    unittest.main()
