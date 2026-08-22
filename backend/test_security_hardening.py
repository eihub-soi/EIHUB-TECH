import unittest
import os
import io
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Mock environment variables before importing app
os.environ["ENVIRONMENT"] = "development"
os.environ["SECRET_KEY"] = "testsecret"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON_PATH"] = ""
os.environ["BREVO_API_KEY"] = ""

from app.main import app, get_current_user, require_admin, require_faculty_or_admin, db_query, db_execute

class TestSecurityHardening(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        
        # In-memory database setup for tests
        import asyncio
        async def init_db():
            await db_execute("DROP TABLE IF EXISTS profiles")
            await db_execute("DROP TABLE IF EXISTS components")
            await db_execute("DROP TABLE IF EXISTS requests")
            await db_execute("DROP TABLE IF EXISTS purchase_orders")
            await db_execute("DROP TABLE IF EXISTS reminder_logs")
            
            await db_execute("""
                CREATE TABLE profiles (
                    id VARCHAR(255) PRIMARY KEY,
                    firebase_uid VARCHAR(255),
                    email VARCHAR(255) UNIQUE,
                    full_name VARCHAR(255),
                    role VARCHAR(255),
                    phone VARCHAR(255),
                    department VARCHAR(255),
                    institution VARCHAR(255),
                    register_number VARCHAR(255),
                    roll_number VARCHAR(255),
                    year_of_study VARCHAR(255),
                    faculty_id VARCHAR(255),
                    is_active INTEGER DEFAULT 1,
                    created_at VARCHAR(255),
                    updated_at VARCHAR(255)
                )
            """)
            
            await db_execute("""
                CREATE TABLE components (
                    id VARCHAR(255) PRIMARY KEY,
                    sku VARCHAR(255),
                    name VARCHAR(255),
                    category VARCHAR(255),
                    description TEXT,
                    total_stock INTEGER,
                    available_stock INTEGER,
                    borrowed_stock INTEGER DEFAULT 0,
                    cabinet VARCHAR(255),
                    shelf VARCHAR(255),
                    location VARCHAR(255),
                    location_details VARCHAR(255),
                    image_url VARCHAR(255),
                    unit VARCHAR(50),
                    unit_cost REAL,
                    updated_at VARCHAR(255),
                    created_at VARCHAR(255)
                )
            """)
            
            await db_execute("""
                CREATE TABLE requests (
                    id VARCHAR(255) PRIMARY KEY,
                    student_id VARCHAR(255),
                    component_id VARCHAR(255),
                    quantity INTEGER,
                    status VARCHAR(255),
                    notes TEXT,
                    reject_reason TEXT,
                    requested_at VARCHAR(255),
                    reviewed_by VARCHAR(255),
                    reviewed_at VARCHAR(255),
                    return_requested_at VARCHAR(255),
                    returned_at VARCHAR(255),
                    return_reviewed_by VARCHAR(255),
                    created_at VARCHAR(255)
                )
            """)
            
            await db_execute("""
                CREATE TABLE purchase_orders (
                    id VARCHAR(255) PRIMARY KEY,
                    po_number VARCHAR(255),
                    supplier_name VARCHAR(255),
                    component_id VARCHAR(255),
                    component_name VARCHAR(255),
                    component_category VARCHAR(255),
                    quantity INTEGER,
                    unit_cost REAL,
                    total_cost REAL,
                    purchased_by VARCHAR(255),
                    purchased_by_name VARCHAR(255),
                    invoice_ref VARCHAR(255),
                    cabinet VARCHAR(255),
                    shelf VARCHAR(255),
                    status VARCHAR(255),
                    purchased_at VARCHAR(255),
                    created_at VARCHAR(255)
                )
            """)
            
        asyncio.run(init_db())
        
        # Default mock user
        self.mock_user = {
            "uid": "usr-student-1",
            "id": "usr-student-1",
            "email": "student@kgkite.ac.in",
            "name": "John Student",
            "role": "student"
        }
        
        # Override dependency
        app.dependency_overrides[get_current_user] = lambda: self.mock_user

    def tearDown(self):
        app.dependency_overrides.clear()

    @patch.dict(os.environ, {"ENV": "production"})
    def test_production_auth_bypass_prevention(self):
        # Override to use original dependency to test it
        app.dependency_overrides.clear()
        
        # Under production mode, demo/mock tokens should be rejected
        headers = {"Authorization": "Bearer demo-admin"}
        response = self.client.get("/api/notifications", headers=headers)
        self.assertEqual(response.status_code, 401, f"Failed: {response.json()}")
        self.assertIn("bypass is disabled", response.json()["detail"])

        # Raw user ID tokens should also be rejected in production
        headers = {"Authorization": "Bearer usr-admin-1"}
        response = self.client.get("/api/notifications", headers=headers)
        self.assertEqual(response.status_code, 401, f"Failed: {response.json()}")
        self.assertIn("bypass is disabled", response.json()["detail"])

    @patch.dict(os.environ, {"ENV": "production"})
    def test_production_email_domain_enforcement(self):
        app.dependency_overrides.clear()
        
        # Mock Firebase token verification success but with external email domain
        with patch("firebase_admin.auth.verify_id_token") as mock_verify:
            mock_verify.return_value = {
                "uid": "usr-external-1",
                "email": "attacker@gmail.com",
                "name": "Attacker"
            }
            headers = {"Authorization": "Bearer dummy.jwt.token"}
            response = self.client.get("/api/notifications", headers=headers)
            self.assertEqual(response.status_code, 403, f"Response: {response.status_code} - {response.text}")
            self.assertIn("official @kgkite.ac.in accounts", response.json()["detail"])

    @patch.dict(os.environ, {"CRON_SECRET": "my_secure_cron_token"})
    def test_cron_endpoint_auth(self):
        # Missing header should fail
        response = self.client.post("/api/cron/check-reminders")
        self.assertEqual(response.status_code, 401)
        
        # Bad token should fail
        response = self.client.post("/api/cron/check-reminders", headers={"Authorization": "Bearer badtoken"})
        self.assertEqual(response.status_code, 401)
        
        # Correct token should pass
        response = self.client.post("/api/cron/check-reminders", headers={"Authorization": "Bearer my_secure_cron_token"})
        self.assertEqual(response.status_code, 200)

    def test_purchase_orders_list_protection(self):
        # Student should be forbidden
        self.mock_user["role"] = "student"
        response = self.client.get("/api/purchase-orders")
        self.assertEqual(response.status_code, 403)
        
        # Faculty should be forbidden
        self.mock_user["role"] = "faculty"
        response = self.client.get("/api/purchase-orders")
        self.assertEqual(response.status_code, 403)
        
        # Admin should pass
        self.mock_user["role"] = "admin"
        response = self.client.get("/api/purchase-orders")
        self.assertEqual(response.status_code, 200)

    def test_reviewer_spoofing_prevention(self):
        import asyncio
        
        # Insert a pending request and component
        async def insert_test_data():
            await db_execute("INSERT INTO components (id, sku, name, total_stock, available_stock) VALUES ('comp-1', 'SKU1', 'Arduino', 10, 10)")
            await db_execute("INSERT INTO profiles (id, email, full_name, role) VALUES ('usr-student-1', 'student@kgkite.ac.in', 'John Student', 'student')")
            await db_execute("INSERT INTO requests (id, student_id, component_id, quantity, status, requested_at) VALUES ('req-1', 'usr-student-1', 'comp-1', 2, 'pending', '2026-08-22T00:00:00Z')")
        
        asyncio.run(insert_test_data())
        
        # Approve as admin "usr-admin-real", but body attempts to spoof reviewer as "usr-faculty-spoofed"
        self.mock_user["uid"] = "usr-admin-real"
        self.mock_user["name"] = "Real Admin"
        self.mock_user["role"] = "admin"
        
        payload = {
            "reviewed_by": "usr-faculty-spoofed",
            "notes": "Legit approve"
        }
        
        response = self.client.post("/api/requests/req-1/approve", json=payload)
        self.assertEqual(response.status_code, 200)
        
        # Verify DB reflects the real authenticated user "usr-admin-real" rather than the body value
        async def check_db():
            rows = await db_query("SELECT reviewed_by FROM requests WHERE id = 'req-1'")
            return rows[0]["reviewed_by"]
            
        reviewed_by = asyncio.run(check_db())
        self.assertEqual(reviewed_by, "usr-admin-real")

    def test_student_return_idor_prevention(self):
        import asyncio
        async def insert_data():
            await db_execute("INSERT INTO components (id, sku, name, total_stock, available_stock) VALUES ('comp-1', 'SKU1', 'Arduino', 10, 10)")
            await db_execute("INSERT INTO requests (id, student_id, component_id, quantity, status, requested_at) VALUES ('req-2', 'usr-student-other', 'comp-1', 1, 'approved', '2026-08-22T00:00:00Z')")
        asyncio.run(insert_data())
        
        # Student usr-student-1 tries to trigger return on req-2 (belongs to usr-student-other)
        self.mock_user["uid"] = "usr-student-1"
        self.mock_user["role"] = "student"
        
        response = self.client.post("/api/requests/req-2/return-request", json={"notes": "returning"})
        self.assertEqual(response.status_code, 403)
        self.assertIn("not authorized", response.json()["detail"])

    def test_negative_zero_quantity_protection(self):
        # Try to submit request with quantity 0
        payload = {
            "student_id": "usr-student-1",
            "component_id": "comp-1",
            "quantity": 0,
            "notes": "Testing"
        }
        response = self.client.post("/api/requests/submit", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("greater than zero", response.json()["detail"])
        
        # Try to submit request with negative quantity
        payload["quantity"] = -5
        response = self.client.post("/api/requests/submit", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("greater than zero", response.json()["detail"])

    def test_profile_deletion_referenced_by_active_borrow(self):
        import asyncio
        async def insert_data():
            await db_execute("INSERT INTO components (id, sku, name, total_stock, available_stock) VALUES ('comp-1', 'SKU1', 'Arduino', 10, 10)")
            await db_execute("INSERT INTO profiles (id, email, full_name, role) VALUES ('usr-borrower-1', 'borrower@kgkite.ac.in', 'Borrower User', 'student')")
            await db_execute("INSERT INTO requests (id, student_id, component_id, quantity, status, requested_at) VALUES ('req-3', 'usr-borrower-1', 'comp-1', 1, 'approved', '2026-08-22T00:00:00Z')")
        asyncio.run(insert_data())
        
        self.mock_user["role"] = "admin"
        response = self.client.delete("/api/profiles/usr-borrower-1")
        self.assertEqual(response.status_code, 400)
        self.assertIn("active borrowed components", response.json()["detail"])

    def test_component_deletion_referenced_by_requests(self):
        import asyncio
        async def insert_data():
            await db_execute("INSERT INTO components (id, sku, name, total_stock, available_stock) VALUES ('comp-active', 'SKU-ACTIVE', 'Active Component', 5, 5)")
            await db_execute("INSERT INTO requests (id, student_id, component_id, quantity, status, requested_at) VALUES ('req-4', 'usr-student-1', 'comp-active', 1, 'pending', '2026-08-22T00:00:00Z')")
        asyncio.run(insert_data())
        
        self.mock_user["role"] = "admin"
        response = self.client.delete("/api/components/comp-active")
        self.assertEqual(response.status_code, 400)
        self.assertIn("referenced by active or pending", response.json()["detail"])

    def test_public_receipt_verification(self):
        import asyncio
        async def insert_data():
            await db_execute("INSERT INTO components (id, sku, name, category, image_url) VALUES ('comp-rec', 'SKU-REC', 'Arduino Board', 'Microcontrollers', 'http://example.com/logo.jpg')")
            await db_execute("INSERT INTO profiles (id, full_name, email) VALUES ('student-rec', 'Alice Student', 'alice@kgkite.ac.in')")
            await db_execute("INSERT INTO requests (id, student_id, component_id, quantity, status, notes, requested_at) VALUES ('12345678-abcd-1234-abcd-1234567890ab', 'student-rec', 'comp-rec', 2, 'approved', 'Project Work', '2026-08-22T00:00:00Z')")
        asyncio.run(insert_data())
        
        # Test without any auth token (anonymous visitor)
        app.dependency_overrides.clear()
        
        # Verify using short code (REQ-12345678)
        response = self.client.get("/api/requests/verify/REQ-12345678")
        self.assertEqual(response.status_code, 200, f"Failed: {response.text}")
        data = response.json()
        self.assertEqual(data["student_name"], "Alice Student")
        self.assertEqual(data["component_name"], "Arduino Board")
        self.assertEqual(data["quantity"], 2)
        
        # Verify using raw UUID
        response = self.client.get("/api/requests/verify/12345678-abcd-1234-abcd-1234567890ab")
        self.assertEqual(response.status_code, 200, f"Failed: {response.text}")
        self.assertEqual(response.json()["student_name"], "Alice Student")

    def test_cache_control_header(self):
        # API request should return no-store Cache-Control header
        response = self.client.get("/api/purchase-orders")
        self.assertIn("Cache-Control", response.headers)
        self.assertEqual(response.headers["Cache-Control"], "no-store, no-cache, must-revalidate, private")

    def test_import_endpoints_file_size_limit(self):
        self.mock_user["role"] = "admin"
        
        # Generate large dummy data (> 5MB)
        large_data = b"x" * (5 * 1024 * 1024 + 100)
        files = {"file": ("test.csv", io.BytesIO(large_data), "text/csv")}
        
        response = self.client.post("/api/admin/components/import/preview", files=files)
        self.assertEqual(response.status_code, 413)
        self.assertIn("File too large", response.json()["detail"])

if __name__ == "__main__":
    unittest.main()
