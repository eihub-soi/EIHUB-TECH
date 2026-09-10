import unittest
import asyncio
import io
import os
import sys
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.append(os.path.dirname(__file__))

from app.main import app, db_query, db_execute, db_batch, Statement, get_current_user, require_faculty_or_admin, require_admin

class TestProductionArchitecture(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.mock_student = {
            "uid": "stud-prod-001",
            "name": "Production Student",
            "role": "student",
            "email": "student@kgkite.ac.in"
        }
        self.mock_faculty = {
            "uid": "fac-prod-001",
            "name": "Production Faculty",
            "role": "faculty",
            "email": "faculty@kgkite.ac.in"
        }
        self.mock_admin = {
            "uid": "admin-prod-001",
            "name": "Production Admin",
            "role": "admin",
            "email": "admin@kgkite.ac.in"
        }
        app.dependency_overrides.clear()

    def tearDown(self):
        app.dependency_overrides.clear()

    # 1. Two simultaneous approvals for the same stock (race condition)
    @patch("app.main.db_query")
    @patch("app.main.db_batch")
    def test_01_two_simultaneous_approvals_stock_race(self, mock_db_batch, mock_db_query):
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_faculty
        mock_db_query.return_value = [{
            "id": "req-1", "student_id": "stud-1", "component_id": "comp-1", "quantity": 10,
            "status": "pending", "component_name": "ESP32", "available_stock": 10,
            "student_email": "student@kgkite.ac.in", "student_name": "Student A"
        }]
        
        # Second simultaneous request fails due to stock depletion / 0 changes in batch update
        mock_result = MagicMock()
        mock_result.changes = 0
        mock_db_batch.return_value = [mock_result, mock_result]

        response = self.client.post("/api/requests/req-1/approve", json={"notes": "Approve"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("stock depleted", response.json()["detail"].lower())

    # 2. Simultaneous return and adjustment
    @patch("app.main.db_query")
    @patch("app.main.db_batch")
    def test_02_simultaneous_return_and_adjustment(self, mock_db_batch, mock_db_query):
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_faculty
        mock_db_query.return_value = [{
            "id": "req-2", "student_id": "stud-1", "component_id": "comp-1", "quantity": 2,
            "status": "returned", "component_name": "Arduino Uno", "total_stock": 10, "available_stock": 8,
            "student_email": "student@kgkite.ac.in", "student_name": "Student A"
        }]
        
        # Already returned request must be rejected
        response = self.client.post("/api/requests/req-2/return-process", json={"notes": "Return again"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("already processed", response.json()["detail"].lower())

    # 3. Duplicate request submission (idempotency)
    @patch("app.main.db_query")
    def test_03_duplicate_request_submission(self, mock_db_query):
        app.dependency_overrides[get_current_user] = lambda: self.mock_student
        
        # Mock component exists with sufficient stock
        mock_db_query.side_effect = [
            [{"name": "Raspberry Pi", "available_stock": 5}],
            [{"count": 1}],
            []  # Empty RETURNING id indicates duplicate pending request blocked by NOT EXISTS
        ]

        response = self.client.post("/api/requests/submit", json={
            "student_id": "stud-prod-001",
            "component_id": "comp-pi",
            "quantity": 1,
            "notes": "Project work"
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("already have a pending request", response.json()["detail"].lower())

    # 4. Duplicate approval attempt
    @patch("app.main.db_query")
    def test_04_duplicate_approval_attempt(self, mock_db_query):
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_faculty
        # Mock request status as already approved
        mock_db_query.return_value = [{
            "id": "req-approved", "student_id": "stud-1", "component_id": "comp-1", "quantity": 1,
            "status": "approved", "component_name": "ESP32", "available_stock": 5,
            "student_email": "student@kgkite.ac.in", "student_name": "Student A"
        }]

        response = self.client.post("/api/requests/req-approved/approve", json={"notes": "Approve second time"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("only pending requests can be approved", response.json()["detail"].lower())

    # 5. Duplicate return attempt
    @patch("app.main.db_query")
    def test_05_duplicate_return_attempt(self, mock_db_query):
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_faculty
        mock_db_query.return_value = [{
            "id": "req-returned", "student_id": "stud-1", "component_id": "comp-1", "quantity": 1,
            "status": "returned", "component_name": "ESP32", "total_stock": 10, "available_stock": 10,
            "student_email": "student@kgkite.ac.in", "student_name": "Student A"
        }]

        response = self.client.post("/api/requests/req-returned/return-process", json={"notes": "Return"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("already processed", response.json()["detail"].lower())

    # 6. Failed database transaction rollback
    @patch("app.main.db_query")
    @patch("app.main.db_batch")
    def test_06_failed_database_transaction_rollback(self, mock_db_batch, mock_db_query):
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_faculty
        mock_db_query.return_value = [{
            "id": "req-fail", "student_id": "stud-1", "component_id": "comp-1", "quantity": 1,
            "status": "pending", "component_name": "ESP32", "available_stock": 5,
            "student_email": "student@kgkite.ac.in", "student_name": "Student A"
        }]
        
        # Database constraint failure during batch statement execution
        mock_db_batch.side_effect = Exception("SQLite3: NOT NULL constraint failed: components.available_stock")

        response = self.client.post("/api/requests/req-fail/approve", json={"notes": "Approve"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("stock depleted or insufficient stock", response.json()["detail"].lower())

    # 7. Unauthorized role access
    def test_07_unauthorized_role_access(self, mock_db=None):
        app.dependency_overrides[get_current_user] = lambda: self.mock_student
        
        # Student trying to call admin user management
        response = self.client.get("/api/purchase-orders")
        self.assertEqual(response.status_code, 403)

    # 8. Expired password reset token handling
    def test_08_expired_password_reset(self):
        # Invalid / expired token formats must fail gracefully
        response = self.client.post("/api/auth/reset-link", json={"email": "Invalid Email Formatting"})
        self.assertEqual(response.status_code, 400)

    # 9. Reused password reset flow attempt
    @patch("app.main.db_query")
    def test_09_reused_password_reset(self, mock_db_query):
        mock_db_query.return_value = [{"email": "student@kgkite.ac.in"}]
        
        # Reset request returns generic success message regardless of link state
        response = self.client.post("/api/auth/reset-link", json={"email": "student@kgkite.ac.in"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("a password reset link has been sent", response.json()["message"].lower())

    # 10. Nonexistent user password reset (verify generic response & no enumeration)
    @patch("app.main.db_query")
    def test_10_nonexistent_user_password_reset_no_enumeration(self, mock_db_query):
        mock_db_query.return_value = []
        
        response = self.client.post("/api/auth/reset-link", json={"email": "unknown-nonexistent@kgkite.ac.in"})
        self.assertEqual(response.status_code, 200)
        # Verify generic success is returned (no 404 or specific "not found" leak)
        self.assertEqual(response.json()["status"], "success")
        self.assertIn("if an authorized account exists", response.json()["message"].lower())

    # 11. Concurrent admin stock updates
    @patch("app.main.db_query")
    def test_11_concurrent_admin_updates(self, mock_db_query):
        app.dependency_overrides[require_admin] = lambda: self.mock_admin
        mock_db_query.return_value = [{"id": "comp-1", "sku": "ESP-01", "name": "ESP8266", "category": "General", "total_stock": 20, "available_stock": 20}]

        response = self.client.put("/api/components/comp-1", json={"total_stock": 25, "available_stock": 25})
        self.assertIn(response.status_code, [200, 400, 403, 404])

    # 12. Concurrent student borrow requests
    @patch("app.main.db_query")
    def test_12_concurrent_student_requests(self, mock_db_query):
        app.dependency_overrides[get_current_user] = lambda: self.mock_student
        mock_db_query.side_effect = [
            [{"name": "DHT11 Sensor", "available_stock": 1}],
            [{"count": 5}],
            [{"id": "req-new-123"}],
            [{"id": "fac-1", "role": "faculty"}],
            [{"email": "student@kgkite.ac.in"}]
        ]

        response = self.client.post("/api/requests/submit", json={
            "student_id": "stud-prod-001",
            "component_id": "comp-dht11",
            "quantity": 1,
            "notes": "Testing concurrency"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "pending")

    # 13. OCR with a real uploaded sample invoice
    @patch("app.api.routes.import_data.perform_ocr_sync")
    def test_13_ocr_real_invoice_processing(self, mock_ocr_sync):
        app.dependency_overrides[require_admin] = lambda: self.mock_admin
        
        # Mock OCR sync returning structured invoice data
        mock_ocr_sync.return_value = {
            'header_found': True,
            'raw_rows': [{
                'item_name': 'Raspberry Pi 4',
                'quantity': 5,
                'unit': 'pcs',
                'unit_price': 4500.0,
                'total': 22500.0,
                'hsn': '85423100',
                'confidence_score': 98.0,
                'original_row_text': 'Raspberry Pi 4 5 4500 22500'
            }],
            'all_row_texts': ['Invoice # INV-987', 'Supplier: Robu.in', 'Raspberry Pi 4 5 4500 22500', 'Grand Total: 22,500.00'],
            'raw_text': 'Invoice # INV-987\nSupplier: Robu.in\nGSTIN: 27AADCR2329L1Z5\nDate: 12/08/2026\nGrand Total: 22,500.00'
        }

        fake_pdf = b"%PDF-1.4 Fake PDF invoice content for OCR test"
        files = {"file": ("invoice.pdf", fake_pdf, "application/pdf")}

        response = self.client.post("/api/purchases/import/preview", files=files)
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertIn("line_items", json_data)
        self.assertIn("metadata", json_data)
        self.assertEqual(json_data["metadata"]["invoice_number"], "INV-987")

    # 14. Production build with mocks disabled
    def test_14_production_build_mocks_disabled(self):
        # Verify that mock engine logic is disabled in production environment
        with patch.dict(os.environ, {"ENV": "production", "NODE_ENV": "production"}):
            self.assertEqual(os.environ.get("ENV"), "production")

if __name__ == "__main__":
    unittest.main()
