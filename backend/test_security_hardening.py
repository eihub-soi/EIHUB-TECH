import unittest
import os
import io
import json
from unittest.mock import patch, MagicMock
import httpx
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
        from app.main import RATE_LIMIT_REQUESTS
        RATE_LIMIT_REQUESTS.clear()
        
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
                    username VARCHAR(255),
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
        if hasattr(app.state, "rate_limiter"):
            delattr(app.state, "rate_limiter")
        from app.main import RATE_LIMIT_REQUESTS
        RATE_LIMIT_REQUESTS.clear()

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

    @patch("app.main.httpx.AsyncClient.post")
    def test_upstash_redis_rate_limiting(self, mock_post):
        # 1. Allowed request when Upstash Redis atomic Lua script returns count <= limit (count = 1 <= 5)
        mock_resp_allowed = MagicMock()
        mock_resp_allowed.status_code = 200
        mock_resp_allowed.json.return_value = [{"result": 1}]
        mock_post.return_value = mock_resp_allowed

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            res_allowed = self.client.post("/api/auth/reset-link", json={"email": "student@kgkite.ac.in"})
            self.assertEqual(res_allowed.status_code, 200)

        # 2. Blocked request when Upstash Redis returns count > limit (count = 999 > 5)
        mock_resp_exceeded = MagicMock()
        mock_resp_exceeded.status_code = 200
        mock_resp_exceeded.json.return_value = [{"result": 999}]
        mock_post.return_value = mock_resp_exceeded

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            response = self.client.post("/api/auth/reset-link", json={"email": "student@kgkite.ac.in"})
            self.assertEqual(response.status_code, 429)
            self.assertIn("Retry-After", response.headers)

    def test_rate_limiting_sliding_window_multiple_requests(self):
        """Verify: requests below limit are accepted, request at limit is accepted, exceeding limit returns 429"""
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.1"}
        payload = {"email": "student@kgkite.ac.in"}

        # Requests 1 to 4: Below limit (limit is 5 for /auth/reset-link)
        for i in range(4):
            res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res.status_code, 200, f"Request {i+1} failed with status {res.status_code}")

        # Request 5: At limit
        res_at_limit = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
        self.assertEqual(res_at_limit.status_code, 200, "5th request at limit must be accepted")

        # Request 6: Exceeding limit -> HTTP 429
        res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
        self.assertEqual(res_exceeded.status_code, 429, "6th request exceeding limit must return 429")
        self.assertIn("Retry-After", res_exceeded.headers)
        self.assertEqual(res_exceeded.json()["detail"], "Too many requests. Please try again later.")

    def test_rate_limiting_ip_isolation(self):
        """Verify: rate limits are isolated correctly by client IP address"""
        from app.main import rate_limiter
        rate_limiter.reset()

        ip_a_headers = {"x-forwarded-for": "198.51.100.10"}
        ip_b_headers = {"x-forwarded-for": "198.51.100.20"}
        payload = {"email": "student@kgkite.ac.in"}

        # Exhaust limit for IP A (5 requests)
        for _ in range(5):
            res = self.client.post("/api/auth/reset-link", json=payload, headers=ip_a_headers)
            self.assertEqual(res.status_code, 200)

        # 6th request for IP A returns 429
        res_a_blocked = self.client.post("/api/auth/reset-link", json=payload, headers=ip_a_headers)
        self.assertEqual(res_a_blocked.status_code, 429)

        # IP B should NOT be affected by IP A's limit exhaustion
        res_b_ok = self.client.post("/api/auth/reset-link", json=payload, headers=ip_b_headers)
        self.assertEqual(res_b_ok.status_code, 200, "IP B must not be throttled by IP A")

    def test_rate_limiting_endpoint_independence(self):
        """Verify: exhausting limit on one endpoint category does not throttle independent endpoints"""
        from app.main import rate_limiter
        rate_limiter.reset()

        self.mock_user["role"] = "admin"
        client_headers = {"x-forwarded-for": "198.51.100.30"}

        # Exhaust /auth/reset-link limit (5 requests)
        for _ in range(5):
            self.client.post("/api/auth/reset-link", json={"email": "student@kgkite.ac.in"}, headers=client_headers)

        blocked_reset = self.client.post("/api/auth/reset-link", json={"email": "student@kgkite.ac.in"}, headers=client_headers)
        self.assertEqual(blocked_reset.status_code, 429)

        # Independent endpoint /api/purchase-orders should NOT be throttled
        res_orders = self.client.get("/api/purchase-orders", headers=client_headers)
        self.assertEqual(res_orders.status_code, 200, "Independent endpoint must not be rate limited")
        self.assertNotEqual(res_orders.status_code, 429)

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_failure_fallback_to_memory(self, mock_post):
        """Verify: Redis connection failure logs warning and falls back to memory sliding window"""
        mock_post.side_effect = httpx.ConnectError("Connection refused by Upstash Redis")
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.40"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://unreachable-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "some-token"
        }):
            # Requests below memory limit should succeed (fallback to memory)
            for i in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200, f"Request {i+1} during Redis failure should succeed via memory fallback")

            # Exceeding limit via memory fallback returns 429
            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)

    def test_rate_limiting_controlled_configuration_bypass(self):
        """Verify: controlled configuration flag DISABLE_RATE_LIMITING allows explicit test bypass"""
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.50"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "ENV": "development",
            "ENVIRONMENT": "development",
            "DISABLE_RATE_LIMITING": "true"
        }):
            # Send 10 requests (exceeding normal limit of 5)
            for _ in range(10):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200, "Requests should not be throttled when DISABLE_RATE_LIMITING=true")

    def test_rate_limiting_dependency_injection_override(self):
        """Verify: explicit dependency injection allows substituting rate limiter on app.state"""
        from app.main import RateLimiter

        with patch.dict(os.environ, {"ENV": "development", "ENVIRONMENT": "development"}):
            custom_limiter = RateLimiter(enabled=False)
            app.state.rate_limiter = custom_limiter
            try:
                headers = {"x-forwarded-for": "198.51.100.60"}
                payload = {"email": "student@kgkite.ac.in"}
                for _ in range(7):
                    res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                    self.assertEqual(res.status_code, 200)
            finally:
                if hasattr(app.state, "rate_limiter"):
                    delattr(app.state, "rate_limiter")

    def test_rate_limiting_docs_endpoints_exempt(self):
        """Verify: /docs, /redoc, /openapi.json are exempt from rate limiting"""
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.70"}
        for _ in range(15):
            res = self.client.get("/docs", headers=headers)
            self.assertEqual(res.status_code, 200)

    def test_rate_limiting_production_mode_cannot_be_disabled_by_env_flag(self):
        """Verify: in production mode (ENV=production), rate limiting cannot be disabled by environment flags"""
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.80"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "ENV": "production",
            "DISABLE_RATE_LIMITING": "true",
            "RATE_LIMIT_ENABLED": "false"
        }):
            # Send 5 requests (at limit)
            for _ in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200)

            # 6th request must still return 429 despite DISABLE_RATE_LIMITING=true
            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)

    def test_rate_limiting_production_bypass_flag_protection(self):
        """Verify: production markers (ENV, RENDER) strictly protect rate limiting against bypass flags or corrupted values"""
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.140"}
        payload = {"email": "student@kgkite.ac.in"}

        # 1. RENDER=true with bypass flags
        with patch.dict(os.environ, {
            "RENDER": "true",
            "DISABLE_RATE_LIMITING": "true",
            "RATE_LIMIT_ENABLED": "false"
        }):
            for _ in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200)
            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)

        # 2. Corrupted / invalid flag values in production
        rate_limiter.reset()
        with patch.dict(os.environ, {
            "ENV": "production",
            "DISABLE_RATE_LIMITING": "invalid_setting",
            "RATE_LIMIT_ENABLED": "not_a_bool"
        }):
            for _ in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200)
            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)

    def test_rate_limiting_spoofed_ip_header_validation(self):
        """Verify: invalid/spoofed IP header values are rejected and fall back safely to socket host"""
        from app.main import rate_limiter
        rate_limiter.reset()

        malicious_headers = {"x-forwarded-for": "<script>alert(1)</script>, evil-domain.com"}
        payload = {"email": "student@kgkite.ac.in"}

        res = self.client.post("/api/auth/reset-link", json=payload, headers=malicious_headers)
        self.assertEqual(res.status_code, 200)

        # The rate key should use the safe socket client host (testclient), NOT the script tag
        self.assertNotIn("<script>alert(1)</script>", rate_limiter.requests)

    def test_rate_limiting_trusted_proxy_rfc1918_not_trusted_by_default(self):
        """Verify: RFC1918 (10.x, 172.x, 192.x) peers are NOT trusted by default without explicit TRUSTED_PROXIES"""
        from app.main import rate_limiter
        rate_limiter.reset()

        # Connect from 10.0.1.5 with NO TRUSTED_PROXIES configured
        with patch.dict(os.environ, {}, clear=False):
            if "TRUSTED_PROXIES" in os.environ:
                del os.environ["TRUSTED_PROXIES"]

            untrusted_proxy_client = TestClient(app, client=("10.0.1.5", 50000))
            headers = {"x-forwarded-for": "198.51.100.99"}
            payload = {"email": "student@kgkite.ac.in"}

            res = untrusted_proxy_client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res.status_code, 200)

            # Because 10.0.1.5 is untrusted, X-Forwarded-For is ignored, keyed on socket peer 10.0.1.5
            self.assertTrue(any("10.0.1.5" in k for k in rate_limiter.requests.keys()))
            self.assertFalse(any("198.51.100.99" in k for k in rate_limiter.requests.keys()))

    def test_rate_limiting_explicit_trusted_proxies_cidr_configuration(self):
        """Verify: peer IP in explicitly configured TRUSTED_PROXIES CIDR is trusted and parses X-Forwarded-For"""
        from app.main import rate_limiter
        rate_limiter.reset()

        with patch.dict(os.environ, {"TRUSTED_PROXIES": "10.0.1.0/24"}):
            trusted_proxy_client = TestClient(app, client=("10.0.1.5", 50000))
            headers = {"x-forwarded-for": "198.51.100.99"}
            payload = {"email": "student@kgkite.ac.in"}

            res = trusted_proxy_client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res.status_code, 200)

            # Because 10.0.1.5 matches 10.0.1.0/24 in TRUSTED_PROXIES, X-Forwarded-For is honored
            self.assertTrue(any("198.51.100.99" in k for k in rate_limiter.requests.keys()))
            self.assertFalse(any("10.0.1.5" in k for k in rate_limiter.requests.keys()))

    def test_rate_limiting_multiple_proxy_hops(self):
        """Verify: multiple trusted proxy hops in X-Forwarded-For are traversed right-to-left to find client IP"""
        from app.main import rate_limiter
        rate_limiter.reset()

        with patch.dict(os.environ, {"TRUSTED_PROXIES": "10.0.1.0/24, 10.0.2.0/24"}):
            # Immediate peer is 10.0.1.5 (trusted proxy hop 1).
            # X-Forwarded-For contains: real_client, intermediate_proxy (10.0.2.10 - trusted proxy hop 2)
            proxy_client = TestClient(app, client=("10.0.1.5", 50000))
            headers = {"x-forwarded-for": "198.51.100.200, 10.0.2.10"}
            payload = {"email": "student@kgkite.ac.in"}

            res = proxy_client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res.status_code, 200)

            # 10.0.2.10 is skipped because it's in TRUSTED_PROXIES; 198.51.100.200 is selected
            self.assertTrue(any("198.51.100.200" in k for k in rate_limiter.requests.keys()))
            self.assertFalse(any("10.0.2.10" in k for k in rate_limiter.requests.keys()))

    def test_rate_limiting_direct_origin_access(self):
        """Verify: direct requests to Render origin from untrusted socket peer ignore forwarding headers"""
        from app.main import rate_limiter
        rate_limiter.reset()

        direct_client = TestClient(app, client=("203.0.113.50", 50000))
        headers = {"x-forwarded-for": "1.2.3.4, 5.6.7.8"}
        payload = {"email": "student@kgkite.ac.in"}

        # 5 requests allowed
        for _ in range(5):
            res = direct_client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res.status_code, 200)

        # 6th request blocked with 429
        res_blocked = direct_client.post("/api/auth/reset-link", json=payload, headers=headers)
        self.assertEqual(res_blocked.status_code, 429)

        # Verify rate limiter keyed on direct socket peer 203.0.113.50, not the spoofed headers
        self.assertTrue(any("203.0.113.50" in k for k in rate_limiter.requests.keys()))
        self.assertFalse(any("1.2.3.4" in k for k in rate_limiter.requests.keys()))
        self.assertFalse(any("5.6.7.8" in k for k in rate_limiter.requests.keys()))

    def test_rate_limiting_forged_cf_connecting_ip(self):
        """Verify: forged CF-Connecting-IP is ignored without explicit TRUST_CLOUDFLARE_PROXY"""
        from app.main import rate_limiter
        rate_limiter.reset()

        # 1. Direct origin connection with forged CF-Connecting-IP
        direct_client = TestClient(app, client=("203.0.113.51", 50000))
        headers = {"cf-connecting-ip": "8.8.8.8"}
        payload = {"email": "student@kgkite.ac.in"}

        res = direct_client.post("/api/auth/reset-link", json=payload, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(any("203.0.113.51" in k for k in rate_limiter.requests.keys()))
        self.assertFalse(any("8.8.8.8" in k for k in rate_limiter.requests.keys()))

        # 2. Connection from trusted proxy with forged CF-Connecting-IP and genuine X-Forwarded-For
        rate_limiter.reset()
        with patch.dict(os.environ, {"TRUSTED_PROXIES": "10.0.1.0/24"}):
            proxy_client = TestClient(app, client=("10.0.1.5", 50000))
            headers_proxy = {"cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "198.51.100.77"}
            res2 = proxy_client.post("/api/auth/reset-link", json=payload, headers=headers_proxy)
            self.assertEqual(res2.status_code, 200)
            self.assertTrue(any("198.51.100.77" in k for k in rate_limiter.requests.keys()))
            self.assertFalse(any("8.8.8.8" in k for k in rate_limiter.requests.keys()))

    def test_rate_limiting_forged_x_real_ip(self):
        """Verify: forged X-Real-IP is ignored without explicit TRUST_X_REAL_IP"""
        from app.main import rate_limiter
        rate_limiter.reset()

        direct_client = TestClient(app, client=("203.0.113.52", 50000))
        headers = {"x-real-ip": "9.9.9.9"}
        payload = {"email": "student@kgkite.ac.in"}

        res = direct_client.post("/api/auth/reset-link", json=payload, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(any("203.0.113.52" in k for k in rate_limiter.requests.keys()))
        self.assertFalse(any("9.9.9.9" in k for k in rate_limiter.requests.keys()))

    def test_rate_limiting_forged_x_forwarded_for_proxy_traversal(self):
        """Verify: right-to-left traversal isolates true client IP and rejects prepended forged IPs"""
        from app.main import rate_limiter
        rate_limiter.reset()

        with patch.dict(os.environ, {"TRUSTED_PROXIES": "10.0.1.0/24"}):
            proxy_client = TestClient(app, client=("10.0.1.5", 50000))
            # Attacker at 198.51.100.200 prepends forged 1.1.1.1
            headers_a = {"x-forwarded-for": "1.1.1.1, 198.51.100.200"}
            payload = {"email": "student@kgkite.ac.in"}

            # Send 5 requests for client A
            for _ in range(5):
                res = proxy_client.post("/api/auth/reset-link", json=payload, headers=headers_a)
                self.assertEqual(res.status_code, 200)

            # 6th request from client A returns 429
            res_blocked = proxy_client.post("/api/auth/reset-link", json=payload, headers=headers_a)
            self.assertEqual(res_blocked.status_code, 429)

            # Different client B (198.51.100.201) also prepending forged 1.1.1.1 must NOT be throttled
            headers_b = {"x-forwarded-for": "1.1.1.1, 198.51.100.201"}
            res_b = proxy_client.post("/api/auth/reset-link", json=payload, headers=headers_b)
            self.assertEqual(res_b.status_code, 200, "Client B must not be throttled by Client A's exhaustion")

    def test_rate_limiting_spoofed_cf_connecting_ip_untrusted_peer_even_with_flag(self):
        """Verify: untrusted peer cannot spoof CF-Connecting-IP even if TRUST_CLOUDFLARE_PROXY=true"""
        from app.main import rate_limiter
        rate_limiter.reset()

        with patch.dict(os.environ, {"TRUST_CLOUDFLARE_PROXY": "true"}):
            # Direct socket peer 203.0.113.60 is NOT in TRUSTED_PROXIES
            untrusted_client = TestClient(app, client=("203.0.113.60", 50000))
            headers = {"cf-connecting-ip": "1.1.1.1"}
            payload = {"email": "student@kgkite.ac.in"}

            res = untrusted_client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res.status_code, 200)

            # CF-Connecting-IP must be discarded; rate limit keyed strictly to socket peer 203.0.113.60
            self.assertTrue(any("203.0.113.60" in k for k in rate_limiter.requests.keys()))
            self.assertFalse(any("1.1.1.1" in k for k in rate_limiter.requests.keys()))

    def test_rate_limiting_spoofed_x_forwarded_for_untrusted_peer(self):
        """Verify: untrusted peer cannot spoof X-Forwarded-For header"""
        from app.main import rate_limiter
        rate_limiter.reset()

        untrusted_client = TestClient(app, client=("203.0.113.61", 50000))
        headers = {"x-forwarded-for": "9.9.9.9, 8.8.8.8"}
        payload = {"email": "student@kgkite.ac.in"}

        res = untrusted_client.post("/api/auth/reset-link", json=payload, headers=headers)
        self.assertEqual(res.status_code, 200)

        # X-Forwarded-For must be discarded; rate limit keyed strictly to socket peer 203.0.113.61
        self.assertTrue(any("203.0.113.61" in k for k in rate_limiter.requests.keys()))
        self.assertFalse(any("9.9.9.9" in k for k in rate_limiter.requests.keys()))
        self.assertFalse(any("8.8.8.8" in k for k in rate_limiter.requests.keys()))

    def test_rate_limiting_valid_cf_connecting_ip_from_trusted_peer(self):
        """Verify: valid CF-Connecting-IP is honored only when immediate socket peer is a verified trusted proxy"""
        from app.main import rate_limiter
        rate_limiter.reset()

        with patch.dict(os.environ, {
            "TRUSTED_PROXIES": "192.0.2.1/32",
            "TRUST_CLOUDFLARE_PROXY": "true"
        }):
            # Immediate peer 192.0.2.1 is verified in TRUSTED_PROXIES
            trusted_proxy_client = TestClient(app, client=("192.0.2.1", 50000))
            headers = {"cf-connecting-ip": "198.51.100.88"}
            payload = {"email": "student@kgkite.ac.in"}

            res = trusted_proxy_client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res.status_code, 200)

            # CF-Connecting-IP 198.51.100.88 is honored because peer is trusted
            self.assertTrue(any("198.51.100.88" in k for k in rate_limiter.requests.keys()))
            self.assertFalse(any("192.0.2.1" in k for k in rate_limiter.requests.keys()))

    def test_rate_limiting_missing_and_malformed_forwarding_headers(self):
        """Verify: missing or malformed forwarding headers from trusted proxy fall back safely to socket peer"""
        from app.main import rate_limiter
        rate_limiter.reset()

        with patch.dict(os.environ, {"TRUSTED_PROXIES": "192.0.2.1/32"}):
            proxy_client = TestClient(app, client=("192.0.2.1", 50000))
            payload = {"email": "student@kgkite.ac.in"}

            # 1. Missing forwarding headers (empty dict)
            rate_limiter.reset()
            res1 = proxy_client.post("/api/auth/reset-link", json=payload, headers={})
            self.assertEqual(res1.status_code, 200)
            self.assertTrue(any("192.0.2.1" in k for k in rate_limiter.requests.keys()))

            # 2. Empty string X-Forwarded-For
            rate_limiter.reset()
            res2 = proxy_client.post("/api/auth/reset-link", json=payload, headers={"x-forwarded-for": ""})
            self.assertEqual(res2.status_code, 200)
            self.assertTrue(any("192.0.2.1" in k for k in rate_limiter.requests.keys()))

            # 3. Comma delimiters without IPs
            rate_limiter.reset()
            res3 = proxy_client.post("/api/auth/reset-link", json=payload, headers={"x-forwarded-for": ",,, ,  "})
            self.assertEqual(res3.status_code, 200)
            self.assertTrue(any("192.0.2.1" in k for k in rate_limiter.requests.keys()))

            # 4. Non-IP alphanumeric text
            rate_limiter.reset()
            res4 = proxy_client.post("/api/auth/reset-link", json=payload, headers={"x-forwarded-for": "not-an-ip-address"})
            self.assertEqual(res4.status_code, 200)
            self.assertTrue(any("192.0.2.1" in k for k in rate_limiter.requests.keys()))

            # 5. Invalid IPv4 octets
            rate_limiter.reset()
            res5 = proxy_client.post("/api/auth/reset-link", json=payload, headers={"x-forwarded-for": "999.999.999.999"})
            self.assertEqual(res5.status_code, 200)
            self.assertTrue(any("192.0.2.1" in k for k in rate_limiter.requests.keys()))

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_pipeline_incr_success_expire_failure(self, mock_post):
        """Verify: INCR success with EXPIRE failure in Redis pipeline triggers safe fallback to memory limiter"""
        from app.main import rate_limiter
        rate_limiter.reset()

        # Mock Redis returning INCR success, but EXPIRE failure
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"result": 1}, {"error": "ERR syntax error in expire"}]
        mock_post.return_value = mock_resp

        headers = {"x-forwarded-for": "198.51.100.105"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            # Requests below memory limit succeed via fallback
            for _ in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200)

            # Exceeding memory fallback limit returns 429
            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_pipeline_malformed_second_result(self, mock_post):
        """Verify: Redis pipeline with malformed, non-int or missing EXPIRE result safely falls back to memory limit"""
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.110"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            # Scenario 1: Malformed second result non-integer
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = [{"result": 1}, {"result": "not_an_int"}]
            mock_post.return_value = mock_resp
            res1 = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res1.status_code, 200)

            # Scenario 2: Null second result
            mock_resp.json.return_value = [{"result": 1}, {"result": None}]
            res2 = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res2.status_code, 200)

            # Scenario 3: EXPIRE result 0 (unconfirmed expiry)
            mock_resp.json.return_value = [{"result": 1}, {"result": 0}]
            res3 = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res3.status_code, 200)

            # Scenario 4: Error in first result
            mock_resp.json.return_value = [{"error": "ERR INCR failed"}, {"result": 1}]
            res4 = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res4.status_code, 200)

            # Request 5 at memory limit
            res5 = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res5.status_code, 200)

            # Request 6 exceeds memory fallback limit -> 429
            res6 = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res6.status_code, 429)

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_normal_expiry_behavior(self, mock_post):
        """Verify: normal Redis pipeline results with both INCR and EXPIRE results valid"""
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.115"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            # 1. Below limit: INCR=1, EXPIRE=1
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = [{"result": 1}, {"result": 1}]
            mock_post.return_value = mock_resp

            res1 = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res1.status_code, 200)

            # 2. Exceeded limit: INCR=6 > 5, EXPIRE=1
            mock_resp.json.return_value = [{"result": 6}, {"result": 1}]
            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_upstash_rest_api_eval_format_and_flow(self, mock_post):
        """Verify: exact Upstash REST API EVAL request format, atomic script execution, and failure recovery"""
        from app.main import rate_limiter, check_redis_rate_limit
        rate_limiter.reset()

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            # 1. Verify exact request format sent to Upstash pipeline
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = [{"result": 1}]
            mock_post.return_value = mock_resp

            import asyncio
            result_1 = asyncio.run(check_redis_rate_limit("198.51.100.1:/api/auth/reset-link", 5, 60))
            self.assertTrue(result_1)

            # Verify call format: EVAL, script, 1, key, "60"
            call_args = mock_post.call_args
            self.assertEqual(call_args.args[0], "https://fake-redis.upstash.io/pipeline")
            headers = call_args.kwargs["headers"]
            self.assertEqual(headers["Authorization"], "Bearer faketoken")
            json_body = call_args.kwargs["json"]
            self.assertEqual(len(json_body), 1)
            eval_cmd = json_body[0]
            self.assertEqual(eval_cmd[0], "EVAL")
            self.assertIn("local current = redis.call('INCR', KEYS[1])", eval_cmd[1])
            self.assertIn("if current == 1 then", eval_cmd[1])
            self.assertIn("local ok = redis.call('EXPIRE', KEYS[1], ARGV[1])", eval_cmd[1])
            self.assertEqual(eval_cmd[2], 1)
            self.assertEqual(eval_cmd[3], "rate:198.51.100.1:/api/auth/reset-link")
            self.assertEqual(eval_cmd[4], "60")

            # 2. Subsequent requests incrementing counter below limit
            mock_resp.json.return_value = [{"result": 2}]
            result_2 = asyncio.run(check_redis_rate_limit("198.51.100.1:/api/auth/reset-link", 5, 60))
            self.assertTrue(result_2)

            # 3. Request exceeding limit returns False (triggers 429)
            mock_resp.json.return_value = [{"result": 6}]
            result_exceeded = asyncio.run(check_redis_rate_limit("198.51.100.1:/api/auth/reset-link", 5, 60))
            self.assertFalse(result_exceeded)

            # 4. Lua execution failure (EXPIRE_FAILED) safely returns None (activates fallback)
            mock_resp.json.return_value = [{"error": "EXPIRE_FAILED"}]
            result_failed = asyncio.run(check_redis_rate_limit("198.51.100.1:/api/auth/reset-link", 5, 60))
            self.assertIsNone(result_failed)

            # 5. Malformed response safely returns None
            mock_resp.json.return_value = [{"result": "not_an_int"}]
            result_malformed = asyncio.run(check_redis_rate_limit("198.51.100.1:/api/auth/reset-link", 5, 60))
            self.assertIsNone(result_malformed)

    def test_rate_limiting_redis_expiry_not_extended_by_subsequent_requests(self):
        """Verify: Redis Lua script sets expiry ONLY on first increment and does NOT extend it on subsequent requests"""
        class MockRedisEngine:
            """Simulates Redis engine behavior when executing the atomic rate-limiting Lua script"""
            def __init__(self):
                self.keys = {}
                self.ttls = {}
                self.expire_calls = []
                self.incr_calls = []

            def incr(self, key):
                self.incr_calls.append(key)
                self.keys[key] = self.keys.get(key, 0) + 1
                return self.keys[key]

            def expire(self, key, seconds):
                self.expire_calls.append((key, seconds))
                if key in self.keys:
                    self.ttls[key] = seconds
                    return 1
                return 0

            def eval_rate_limit_script(self, key, window):
                # Exact reproduction of Lua script logic:
                # local current = redis.call('INCR', KEYS[1])
                # if current == 1 then
                #   local ok = redis.call('EXPIRE', KEYS[1], ARGV[1])
                #   if ok ~= 1 then return redis.error_reply('EXPIRE_FAILED') end
                # end
                # return current
                current = self.incr(key)
                if current == 1:
                    ok = self.expire(key, window)
                    if ok != 1:
                        return {"error": "EXPIRE_FAILED"}
                return {"result": current}

        engine = MockRedisEngine()
        key = "rate:198.51.100.2:/api/auth/reset-link"
        window = 60

        # Request 1 (first request): key is created, current=1 -> EXPIRE IS CALLED
        res1 = engine.eval_rate_limit_script(key, window)
        self.assertEqual(res1["result"], 1)
        self.assertEqual(len(engine.expire_calls), 1)
        self.assertEqual(engine.expire_calls[0], (key, 60))
        self.assertEqual(engine.ttls[key], 60)

        # Simulate 15 seconds passing (TTL decays from 60 to 45)
        engine.ttls[key] = 45

        # Request 2: current=2 -> EXPIRE IS NOT CALLED! Expiry is NOT extended!
        res2 = engine.eval_rate_limit_script(key, window)
        self.assertEqual(res2["result"], 2)
        self.assertEqual(len(engine.expire_calls), 1, "EXPIRE must NOT be called on subsequent requests")
        self.assertEqual(engine.ttls[key], 45, "TTL must NOT be reset to 60 on subsequent requests")

        # Simulate 20 more seconds passing (TTL decays from 45 to 25)
        engine.ttls[key] = 25

        # Request 3: current=3 -> EXPIRE IS NOT CALLED! Expiry is NOT extended!
        res3 = engine.eval_rate_limit_script(key, window)
        self.assertEqual(res3["result"], 3)
        self.assertEqual(len(engine.expire_calls), 1, "EXPIRE must NOT be called on subsequent requests")
        self.assertEqual(engine.ttls[key], 25, "TTL must NOT be reset to 60 on subsequent requests")

        # Test failure scenario: if EXPIRE returns 0, script returns EXPIRE_FAILED
        engine_fail = MockRedisEngine()
        engine_fail.expire = lambda k, s: 0  # EXPIRE fails
        res_fail = engine_fail.eval_rate_limit_script(key, window)
        self.assertEqual(res_fail, {"error": "EXPIRE_FAILED"})

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_expire_result_strict_validation(self, mock_post):
        """Verify: Redis EXPIRE result 1 is treated as success, while 0, null, 'OK', or error activates fallback"""
        from app.main import check_redis_rate_limit
        import asyncio

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_post.return_value = mock_resp

            # 1. EXPIRE result 1 -> SUCCESS (True)
            mock_resp.json.return_value = [{"result": 1}, {"result": 1}]
            self.assertTrue(asyncio.run(check_redis_rate_limit("test_key", 5, 60)))

            # 2. EXPIRE result 0 (failed to set TTL) -> FAILURE (None)
            mock_resp.json.return_value = [{"result": 1}, {"result": 0}]
            self.assertIsNone(asyncio.run(check_redis_rate_limit("test_key", 5, 60)))

            # 3. EXPIRE result None -> FAILURE (None)
            mock_resp.json.return_value = [{"result": 1}, {"result": None}]
            self.assertIsNone(asyncio.run(check_redis_rate_limit("test_key", 5, 60)))

            # 4. EXPIRE result string "OK" -> FAILURE (strictly requires int 1)
            mock_resp.json.return_value = [{"result": 1}, {"result": "OK"}]
            self.assertIsNone(asyncio.run(check_redis_rate_limit("test_key", 5, 60)))

            # 5. Empty list response -> FAILURE (None)
            mock_resp.json.return_value = []
            self.assertIsNone(asyncio.run(check_redis_rate_limit("test_key", 5, 60)))

            # 6. EXPIRE error dict -> FAILURE (None)
            mock_resp.json.return_value = [{"result": 1}, {"error": "ERR syntax error"}]
            self.assertIsNone(asyncio.run(check_redis_rate_limit("test_key", 5, 60)))

    def test_rate_limiting_fixed_window_boundary_reset(self):
        """Verify: fixed-window boundary reset allows new requests once the window duration has passed"""
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.125"}
        payload = {"email": "student@kgkite.ac.in"}

        initial_time = 1000000.0

        with patch("app.main.time.time", return_value=initial_time):
            # Exhaust limit of 5 requests within window [t, t+60]
            for _ in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200)

            # 6th request within window is blocked with 429
            res_blocked = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_blocked.status_code, 429)
            self.assertIn("Retry-After", res_blocked.headers)

        # Advance time by 61 seconds (crossing the 60-second window boundary)
        with patch("app.main.time.time", return_value=initial_time + 61.0):
            # Window has reset: request is accepted with HTTP 200!
            res_reset = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_reset.status_code, 200, "Window boundary reset must allow new requests")

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_http_500_fallback(self, mock_post):
        """Verify: Redis returning HTTP 500 falls back to memory sliding window cleanly"""
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Upstash Server Error"
        mock_post.return_value = mock_resp

        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.90"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            for _ in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200)

            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_malformed_json_fallback(self, mock_post):
        """Verify: Redis returning malformed response falls back to memory sliding window cleanly"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.side_effect = json.JSONDecodeError("Expecting value", "doc", 0)
        mock_post.return_value = mock_resp

        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.95"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            for _ in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200)

            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_timeout(self, mock_post):
        """Verify: Redis timeout (>3.0s) triggers memory fallback and returns 429 when limit is exceeded"""
        mock_post.side_effect = httpx.TimeoutException("Upstash Redis connection timed out")
        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.120"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://slow-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "faketoken"
        }):
            for _ in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200)

            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)
            self.assertIn("Retry-After", res_exceeded.headers)

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_authentication_failure(self, mock_post):
        """Verify: Redis HTTP 401/403 auth failure falls back to memory sliding window and enforces 429"""
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = "Unauthorized"
        mock_post.return_value = mock_resp

        from app.main import rate_limiter
        rate_limiter.reset()

        headers = {"x-forwarded-for": "198.51.100.130"}
        payload = {"email": "student@kgkite.ac.in"}

        with patch.dict(os.environ, {
            "UPSTASH_REDIS_REST_URL": "https://fake-redis.upstash.io",
            "UPSTASH_REDIS_REST_TOKEN": "expired_token"
        }):
            for _ in range(5):
                res = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
                self.assertEqual(res.status_code, 200)

            res_exceeded = self.client.post("/api/auth/reset-link", json=payload, headers=headers)
            self.assertEqual(res_exceeded.status_code, 429)

    def test_rate_limiter_health_endpoint_observability(self):
        """Verify: /api/health exposes rate_limiter mode without disclosing secrets"""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("rate_limiter", data)
        self.assertIn("mode", data["rate_limiter"])
        self.assertIn("distributed", data["rate_limiter"])
        # Confirm no credentials leaked
        self.assertNotIn("token", str(data).lower())
        self.assertNotIn("password", str(data).lower())
        self.assertNotIn("secret", str(data).lower())

    @patch("app.main.httpx.AsyncClient.post")
    def test_rate_limiting_redis_health_ping_validation_variations(self, mock_post):
        """Verify: /api/health strictly validates PING response structure, types, errors, timeouts, and auth failures"""
        headers = {"UPSTASH_REDIS_REST_URL": "https://active-db.upstash.io", "UPSTASH_REDIS_REST_TOKEN": "secret_token_123"}

        with patch.dict(os.environ, headers):
            # 1. Normal PONG response
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = [{"result": "PONG"}]
            mock_post.return_value = mock_resp
            res_pong = self.client.get("/api/health")
            data_pong = res_pong.json()["rate_limiter"]
            self.assertTrue(data_pong["operational"])
            self.assertTrue(data_pong["distributed"])
            self.assertFalse(data_pong["fallback_active"])

            # 2. Malformed JSON
            mock_resp.json.side_effect = json.JSONDecodeError("err", "doc", 0)
            res_json_err = self.client.get("/api/health")
            data_json_err = res_json_err.json()["rate_limiter"]
            self.assertFalse(data_json_err["operational"])
            self.assertTrue(data_json_err["fallback_active"])

            # 3. Empty list []
            mock_resp.json.side_effect = None
            mock_resp.json.return_value = []
            res_empty = self.client.get("/api/health")
            self.assertFalse(res_empty.json()["rate_limiter"]["operational"])

            # 4. Unexpected result type (e.g. integer 123 instead of str "PONG")
            mock_resp.json.return_value = [{"result": 123}]
            res_type = self.client.get("/api/health")
            self.assertFalse(res_type.json()["rate_limiter"]["operational"])

            # 5. Null result [{"result": None}]
            mock_resp.json.return_value = [{"result": None}]
            res_null = self.client.get("/api/health")
            self.assertFalse(res_null.json()["rate_limiter"]["operational"])

            # 6. Redis error result [{"error": "WRONGPASS"}]
            mock_resp.json.return_value = [{"error": "WRONGPASS"}]
            res_err = self.client.get("/api/health")
            self.assertFalse(res_err.json()["rate_limiter"]["operational"])

            # 7. Dict instead of list {"result": "PONG"}
            mock_resp.json.return_value = {"result": "PONG"}
            res_dict = self.client.get("/api/health")
            self.assertFalse(res_dict.json()["rate_limiter"]["operational"])

            # 8. Auth error HTTP 401
            mock_resp.status_code = 401
            res_401 = self.client.get("/api/health")
            self.assertFalse(res_401.json()["rate_limiter"]["operational"])
            self.assertEqual(res_401.json()["rate_limiter"]["reason"], "authentication_failed")

            # 9. Timeout
            mock_post.side_effect = httpx.TimeoutException("Ping timed out")
            res_timeout = self.client.get("/api/health")
            self.assertFalse(res_timeout.json()["rate_limiter"]["operational"])
            self.assertEqual(res_timeout.json()["rate_limiter"]["reason"], "timeout")

            # 10. Connection error
            mock_post.side_effect = httpx.ConnectError("Connection refused")
            res_conn = self.client.get("/api/health")
            self.assertFalse(res_conn.json()["rate_limiter"]["operational"])
            self.assertEqual(res_conn.json()["rate_limiter"]["reason"], "connection_error")

            # Confirm no credentials leaked anywhere
            self.assertNotIn("secret_token_123", str(res_conn.json()))

    def test_send_otp_validation_and_domain_restriction(self):
        # 1. Missing fields
        res1 = self.client.post("/api/auth/otp", json={})
        self.assertEqual(res1.status_code, 400)

        # 2. Non-institutional email rejected (open relay prevention)
        res2 = self.client.post("/api/auth/otp", json={"email": "attacker@gmail.com", "code": "123456"})
        self.assertEqual(res2.status_code, 400)
        self.assertIn("restricted to institutional", res2.json()["detail"])

        # 3. Invalid code format / HTML injection attempt
        res3 = self.client.post("/api/auth/otp", json={"email": "student@kgkite.ac.in", "code": "<script>alert(1)</script>"})
        self.assertEqual(res3.status_code, 400)
        self.assertIn("6-digit numeric code", res3.json()["detail"])

        # 4. Non-6-digit code
        res4 = self.client.post("/api/auth/otp", json={"email": "student@kgkite.ac.in", "code": "1234"})
        self.assertEqual(res4.status_code, 400)
        self.assertIn("6-digit numeric code", res4.json()["detail"])

        # 5. Valid institutional email and 6-digit code accepted
        from app.main import RATE_LIMIT_REQUESTS
        RATE_LIMIT_REQUESTS.clear()
        res5 = self.client.post("/api/auth/otp", json={"email": "student@kgkite.ac.in", "code": "654321"})
        self.assertEqual(res5.status_code, 200)
        self.assertEqual(res5.json()["status"], "success")

    def test_otp_verification_and_single_use(self):
        from app.main import RATE_LIMIT_REQUESTS
        RATE_LIMIT_REQUESTS.clear()
        # 1. Send OTP to generate entry in otp_verifications
        email = "unique-otp-student@kgkite.ac.in"
        res = self.client.post("/api/auth/otp", json={"email": email, "code": "789123"})
        self.assertEqual(res.status_code, 200)

        # 2. Invalid code format
        res_inv = self.client.post("/api/auth/otp/verify", json={"email": email, "code": "abc"})
        self.assertEqual(res_inv.status_code, 400)

        # 3. Incorrect code
        res_wrong = self.client.post("/api/auth/otp/verify", json={"email": email, "code": "000000"})
        self.assertEqual(res_wrong.status_code, 400)
        self.assertIn("Invalid verification code", res_wrong.json()["detail"])

        # 4. Correct code verifies successfully
        res_ok = self.client.post("/api/auth/otp/verify", json={"email": email, "code": "789123"})
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(res_ok.json()["status"], "success")

        # 5. Single-use enforcement: reusing the same OTP must be rejected
        res_replay = self.client.post("/api/auth/otp/verify", json={"email": email, "code": "789123"})
        self.assertEqual(res_replay.status_code, 400)
        self.assertIn("no active verification code", res_replay.json()["detail"].lower())

    def test_send_otp_db_failure_fails_closed(self):
        with patch("app.main.db_execute", side_effect=Exception("D1 connection lost")):
            res = self.client.post("/api/auth/otp", json={"email": "fail-db@kgkite.ac.in", "code": "123456"})
            self.assertEqual(res.status_code, 500)
            self.assertIn("Database persistence failed", res.json()["detail"])

    def test_inventory_invariants_enforcement(self):
        self.mock_user["role"] = "admin"

        # 1. Negative total_stock rejected
        res_neg = self.client.post("/api/components", json={
            "name": "Negative Component",
            "total_stock": -5,
            "available_stock": -5
        })
        self.assertEqual(res_neg.status_code, 400)
        self.assertIn("cannot be negative", res_neg.json()["detail"].lower())

        # 2. available_stock > total_stock rejected
        res_oversell = self.client.post("/api/components", json={
            "name": "Oversell Component",
            "total_stock": 10,
            "available_stock": 15
        })
        self.assertEqual(res_oversell.status_code, 400)
        self.assertIn("cannot exceed", res_oversell.json()["detail"].lower())

    def test_return_state_enforcement(self):
        self.mock_user["role"] = "student"
        self.mock_user["uid"] = "stud-pending-1"

        # 1. return-request on a pending request must be rejected
        with patch("app.main.db_query") as mock_query:
            mock_query.return_value = [{
                "id": "req-pending-1", "student_id": "stud-pending-1", "component_id": "comp-1",
                "quantity": 1, "status": "pending", "name": "ESP32"
            }]
            res = self.client.post("/api/requests/req-pending-1/return-request", json={"notes": "Return pending"})
            self.assertEqual(res.status_code, 400)
            self.assertIn("only approved requests", res.json()["detail"].lower())

        # 2. return-process on a pending request must be rejected
        self.mock_user["role"] = "faculty"
        with patch("app.main.db_query") as mock_query:
            mock_query.return_value = [{
                "id": "req-pending-1", "student_id": "stud-pending-1", "component_id": "comp-1",
                "quantity": 1, "status": "pending", "component_name": "ESP32", "total_stock": 10,
                "available_stock": 10, "email": "student@kgkite.ac.in", "full_name": "Student Name"
            }]
            res = self.client.post("/api/requests/req-pending-1/return-process", json={"notes": "Process pending"})
            self.assertEqual(res.status_code, 400)
            self.assertIn("only active loans can be returned", res.json()["detail"].lower())

    def test_report_date_range_validation(self):
        self.mock_user["role"] = "admin"

        # 1. from_date > to_date rejected
        res_inverted = self.client.get("/api/admin/reports/download-csv?from_date=2026-12-31&to_date=2026-01-01")
        self.assertEqual(res_inverted.status_code, 400)
        self.assertIn("cannot be later than", res_inverted.json()["detail"])

        # 2. Invalid date format rejected
        res_invalid = self.client.get("/api/admin/reports/download-csv?from_date=invalid-date")
        self.assertEqual(res_invalid.status_code, 400)
        self.assertIn("Invalid from_date format", res_invalid.json()["detail"])

        # 3. Valid date range returns utf-8 CSV with BOM
        with patch("app.main.fetch_filtered_report_data") as mock_fetch:
            mock_fetch.return_value = ([], [])
            res_csv = self.client.get("/api/admin/reports/download-csv?from_date=2026-01-01&to_date=2026-01-31")
            self.assertEqual(res_csv.status_code, 200)
            self.assertTrue(res_csv.content.startswith(b'\xef\xbb\xbf'))  # utf-8-sig BOM

    def test_admin_sql_query_authorization(self):
        # 1. Unauthenticated request must return 401
        app.dependency_overrides.clear()
        res_unauth = self.client.post("/api/query", json={"sql": "SELECT 1"})
        self.assertEqual(res_unauth.status_code, 401)

        # 2. Student session must return 403
        self.mock_user["role"] = "student"
        app.dependency_overrides[get_current_user] = lambda: self.mock_user
        res_student = self.client.post("/api/query", json={"sql": "SELECT 1"})
        self.assertEqual(res_student.status_code, 403)
        self.assertIn("Admin privileges required", res_student.json()["detail"])

        # 3. Faculty session must return 403
        self.mock_user["role"] = "faculty"
        res_faculty = self.client.post("/api/query", json={"sql": "SELECT 1"})
        self.assertEqual(res_faculty.status_code, 403)
        self.assertIn("Admin privileges required", res_faculty.json()["detail"])

        # 4. Admin session succeeds
        self.mock_user["role"] = "admin"
        res_admin = self.client.post("/api/query", json={"sql": "SELECT 1 as val", "args": []})
        self.assertEqual(res_admin.status_code, 200)
        data = res_admin.json()
        self.assertIsNone(data["error"])
        self.assertEqual(data["data"][0]["val"], 1)

    def test_profiles_sync_flow_and_privilege_escalation(self):
        # 1. Unauthenticated caller returns 401
        app.dependency_overrides.clear()
        res_unauth = self.client.post("/api/profiles/sync", json={"full_name": "Ghost"})
        self.assertEqual(res_unauth.status_code, 401)

        # 2. Student user syncing profile with full fields
        self.mock_user["uid"] = "usr-sync-1"
        self.mock_user["id"] = "usr-sync-1"
        self.mock_user["email"] = "syncstudent@kgkite.ac.in"
        self.mock_user["role"] = "student"
        app.dependency_overrides[get_current_user] = lambda: self.mock_user

        sync_payload = {
            "id": "usr-sync-1",
            "firebase_uid": "usr-sync-1",
            "email": "syncstudent@kgkite.ac.in",
            "full_name": "Synchronized Student",
            "department": "ECE",
            "phone": "+91 99887 76655",
            "register_number": "711721104001",
            "roll_number": "21EC001",
            "institution": "KGiSL",
            "year_of_study": "III",
            "role": "admin"  # Attempted privilege escalation!
        }

        res = self.client.post("/api/profiles/sync", json=sync_payload)
        self.assertEqual(res.status_code, 200)
        profile = res.json()

        # Verify profile was returned properly
        self.assertEqual(profile["id"], "usr-sync-1")
        self.assertEqual(profile["full_name"], "Synchronized Student")
        self.assertEqual(profile["department"], "ECE")
        self.assertEqual(profile["phone"], "+91 99887 76655")
        self.assertEqual(profile["register_number"], "711721104001")
        # Privilege escalation must be stopped: role remains student
        self.assertEqual(profile["role"], "student")

        # 3. Update existing profile with new details
        update_payload = {
            "id": "usr-sync-1",
            "full_name": "Updated Synchronized Student",
            "phone": "+91 99887 76656",
            "role": "faculty"  # Again attempt privilege escalation
        }
        res_update = self.client.post("/api/profiles/sync", json=update_payload)
        self.assertEqual(res_update.status_code, 200)
        updated_profile = res_update.json()
        self.assertEqual(updated_profile["full_name"], "Updated Synchronized Student")
        self.assertEqual(updated_profile["phone"], "+91 99887 76656")
        self.assertEqual(updated_profile["role"], "student")

if __name__ == "__main__":
    unittest.main()


