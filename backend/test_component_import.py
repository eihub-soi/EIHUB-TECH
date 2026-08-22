import unittest
import json
import io
import pandas as pd
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(__file__))

from app.main import app, get_current_user, require_faculty_or_admin

class TestComponentImport(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.mock_user = {
            "uid": "test-faculty-uid",
            "name": "Test Faculty",
            "role": "faculty",
            "email": "faculty@test.com"
        }
        # Override requirement dependencies globally for testing import routes
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_user
        app.dependency_overrides[get_current_user] = lambda: self.mock_user
        
    def tearDown(self):
        app.dependency_overrides.clear()
        
    @patch("app.api.routes.import_data.db_query")
    def test_analyze_endpoint(self, mock_db_query):
        # Create a mock CSV with headers and duplicate entries
        csv_data = (
            "SKU Code,Component Name,Category,Total Stock,Unit Cost (₹ INR),Cabinet Rack,Image URL\n"
            "SKU-ESP32,ESP32 Module,Microcontrollers,10,350,Lab A,https://example.com/esp32.jpg\n"
            "SKU-ESP32,esp32 module,Microcontrollers,5,360,Lab A,https://example.com/esp32.jpg\n"
            "SKU-DHT22,DHT22 Sensor,Sensors,-1,120,Lab B,\n" # Invalid stock count
        )
        
        file = {"file": ("test_import.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
        
        response = self.client.post("/api/imports/components/analyze", files=file)
        
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertTrue(res_json["success"])
        
        # Verify stats and duplicate merging
        stats = res_json["stats"]
        self.assertEqual(stats["total_rows"], 2) # ESP32 combined (1 row) + DHT22 (1 row)
        self.assertEqual(stats["duplicates_merged"], 1) # 1 duplicate merged
        
        # Verify that duplicate stock was aggregated: 10 + 5 = 15
        rows = res_json["rows"]
        esp32_row = next(r for r in rows if r["data"]["name"] == "Esp32 Module")
        self.assertEqual(esp32_row["data"]["total_stock"], 15)
        self.assertEqual(esp32_row["data"]["sku"], "SKU-ESP32")
        self.assertEqual(esp32_row["data"]["unit_cost"], 350.0)
        self.assertEqual(esp32_row["data"]["location"], "Lab A")
        self.assertEqual(esp32_row["data"]["image_url"], "https://example.com/esp32.jpg")
        
        # Verify validation error on DHT22
        dht22_row = next(r for r in rows if r["data"]["name"] == "Dht22 Sensor")
        self.assertEqual(dht22_row["status"], "error")
        self.assertIn("Total Stock cannot be negative", dht22_row["errors"])

    @patch("app.api.routes.import_data.db_query")
    def test_verify_endpoint(self, mock_db_query):
        # Mock database returning one existing component
        mock_db_query.return_value = [
            {
                "id": "existing-uuid-123",
                "sku": "SKU-UNO",
                "name": "Arduino Uno",
                "category": "Microcontrollers",
                "description": "Original Arduino",
                "total_stock": 20,
                "available_stock": 18,
                "location": "Lab A",
                "unit": "pcs",
                "unit_cost": 450.0,
                "image_url": "https://example.com/uno.jpg"
            }
        ]
        
        payload = {
            "rows": [
                {
                    "__row_index": 0,
                    "status": "valid",
                    "errors": [],
                    "warnings": [],
                    "data": {
                        "sku": "SKU-UNO",
                        "name": "arduino uno", # case insensitive match
                        "category": "Microcontrollers",
                        "description": "Uploaded Arduino",
                        "total_stock": 10,
                        "features": "",
                        "unit_cost": 450.0,
                        "location": "Lab A",
                        "image_url": "https://example.com/uno.jpg"
                    }
                },
                {
                    "__row_index": 1,
                    "status": "valid",
                    "errors": [],
                    "warnings": [],
                    "data": {
                        "sku": "SKU-PI",
                        "name": "Raspberry Pi", # new component
                        "category": "Microcontrollers",
                        "description": "Mini PC",
                        "total_stock": 5,
                        "features": "",
                        "unit_cost": 3500.0,
                        "location": "Lab B",
                        "image_url": ""
                    }
                }
            ]
        }
        
        response = self.client.post("/api/imports/components/verify", json=payload)
        
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        rows = res_json["rows"]
        
        # Verify Arduino Uno is identified as existing
        arduino_row = next(r for r in rows if r["data"]["name"] == "arduino uno")
        self.assertTrue(arduino_row["is_existing"])
        self.assertFalse(arduino_row["is_new"])
        self.assertEqual(arduino_row["existing_id"], "existing-uuid-123")
        self.assertEqual(arduino_row["old_stock"], 20)
        self.assertEqual(arduino_row["new_stock_add"], 30)
        
        # Verify Raspberry Pi is identified as new
        pi_row = next(r for r in rows if r["data"]["name"] == "Raspberry Pi")
        self.assertTrue(pi_row["is_new"])
        self.assertFalse(pi_row["is_existing"])

    @patch("app.api.routes.import_data.db_query")
    @patch("app.api.routes.import_data.db_batch")
    @patch("app.api.routes.import_data.log_activity")
    def test_commit_endpoint_add_mode(self, mock_log, mock_batch, mock_db_query):
        # Mock select query returning existing stock levels
        mock_db_query.return_value = [
            {"id": "existing-uuid-123", "total_stock": 20, "available_stock": 18}
        ]
        
        payload = {
            "rows": [
                {
                    "status": "valid",
                    "is_existing": True,
                    "existing_id": "existing-uuid-123",
                    "old_stock": 20,
                    "old_available": 18,
                    "data": {
                        "sku": "SKU-UNO",
                        "name": "Arduino Uno",
                        "category": "Microcontrollers",
                        "description": "Original Arduino",
                        "total_stock": 10,
                        "features": "USB Type-B",
                        "unit_cost": 450.0,
                        "location": "Lab A",
                        "image_url": "https://example.com/uno.jpg"
                    }
                }
            ],
            "options": {
                "mode": "add"
            }
        }
        
        response = self.client.post("/api/imports/components/commit", json=payload)
        
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertTrue(res_json["success"])
        
        # Verify update query was generated and batch execution was called
        self.assertTrue(mock_batch.called)
        statements = mock_batch.call_args[0][0]
        self.assertEqual(len(statements), 1)
        
        # Total stock updated: 20 + 10 = 30, Available updated: 18 + 10 = 28
        self.assertIn("UPDATE components", statements[0].sql)
        self.assertEqual(statements[0].args[4], 30) # total_stock arg index
        self.assertEqual(statements[0].args[5], 28) # available_stock arg index

    @patch("app.api.routes.import_data.db_query")
    @patch("app.api.routes.import_data.db_batch")
    @patch("app.api.routes.import_data.log_activity")
    def test_commit_endpoint_replace_mode(self, mock_log, mock_batch, mock_db_query):
        # Mock select query returning existing stock levels
        mock_db_query.return_value = [
            {"id": "existing-uuid-123", "total_stock": 20, "available_stock": 18}
        ]
        
        payload = {
            "rows": [
                {
                    "status": "valid",
                    "is_existing": True,
                    "existing_id": "existing-uuid-123",
                    "old_stock": 20,
                    "old_available": 18,
                    "data": {
                        "sku": "SKU-UNO",
                        "name": "Arduino Uno",
                        "category": "Microcontrollers",
                        "description": "Original Arduino",
                        "total_stock": 10, # replace with 10 total
                        "features": "USB Type-B",
                        "unit_cost": 450.0,
                        "location": "Lab A",
                        "image_url": "https://example.com/uno.jpg"
                    }
                }
            ],
            "options": {
                "mode": "replace"
            }
        }
        
        response = self.client.post("/api/imports/components/commit", json=payload)
        
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertTrue(res_json["success"])
        
        # Verify update query was generated and batch execution was called
        self.assertTrue(mock_batch.called)
        statements = mock_batch.call_args[0][0]
        self.assertEqual(len(statements), 1)
        
        # Total stock updated: 20 + 10 = 30, Available updated: 18 + 10 = 28 (replace mode ignored)
        self.assertIn("UPDATE components", statements[0].sql)
        self.assertEqual(statements[0].args[4], 30) # total_stock arg index
        self.assertEqual(statements[0].args[5], 28) # available_stock arg index

if __name__ == "__main__":
    unittest.main()
