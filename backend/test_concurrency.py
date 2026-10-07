import unittest
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(__file__))

from app.main import app, D1Client, Statement, get_current_user, require_faculty_or_admin

class TestBackendConcurrency(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.mock_user = {
            "uid": "test-faculty-uid",
            "name": "Test Faculty",
            "role": "faculty",
            "email": "faculty@test.com"
        }
        app.dependency_overrides[require_faculty_or_admin] = lambda: self.mock_user
        app.dependency_overrides[get_current_user] = lambda: self.mock_user

    def tearDown(self):
        app.dependency_overrides.clear()

    @patch("httpx.AsyncClient.post")
    def test_d1_client_batch_payload(self, mock_post):
        # Mock D1 query response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "result": [
                {
                    "success": True,
                    "meta": {"changes": 1},
                    "results": [{"id": 1, "name": "ESP32"}]
                },
                {
                    "success": True,
                    "meta": {"changes": 1},
                    "results": []
                }
            ]
        }
        mock_post.return_value = mock_response

        client = D1Client("test_account", "test_db", "test_token")
        statements = [
            Statement("SELECT * FROM components WHERE id = ?", ["comp-1"]),
            Statement("UPDATE components SET total_stock = ? WHERE id = ?", [10, "comp-1"])
        ]

        results = asyncio.run(client.batch(statements))

        # Verify that a single HTTP POST request was made containing the array of statements
        self.assertEqual(mock_post.call_count, 1)
        call_args, call_kwargs = mock_post.call_args_list[0]
        
        payload = call_kwargs["json"]
        self.assertTrue(isinstance(payload, dict))
        self.assertIn("sql", payload)
        self.assertIn("params", payload)
        self.assertIn("SELECT * FROM components WHERE id = ?", payload["sql"])
        self.assertIn("UPDATE components SET total_stock = ? WHERE id = ?", payload["sql"])
        self.assertEqual(payload["params"], ["comp-1", 10, "comp-1"])

        # Verify the returned ResultSets
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].columns, ["id", "name"])
        self.assertEqual(results[0].rows, [[1, "ESP32"]])
        self.assertEqual(results[1].rows, [])

    @patch("app.main.db_query")
    @patch("app.main.db_batch")
    def test_approve_depleted_stock_rollback(self, mock_db_batch, mock_db_query):
        # Mock the requested component with insufficient stock (e.g. request wants 10, available is 5)
        mock_db_query.return_value = [
            {
                "id": "req-1",
                "student_id": "stud-1",
                "component_id": "comp-1",
                "quantity": 10,
                "status": "pending",
                "component_name": "ESP32",
                "available_stock": 5,
                "student_email": "stud@test.com",
                "student_name": "Student A"
            }
        ]

        # Call approve request endpoint. The informational stock check must trigger a 400 immediately
        response = self.client.post("/api/requests/req-1/approve", json={"reviewed_by": "fac-1", "notes": "approve"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("stock depleted", response.json()["detail"].lower())

    @patch("app.main.db_query")
    @patch("app.main.db_batch")
    def test_approve_constraint_failure_rollback(self, mock_db_batch, mock_db_query):
        # Mock the requested component with sufficient informational stock (e.g., request wants 5, available is 10)
        # but during batch execution, another concurrent thread depleted it, raising a constraint failure
        mock_db_query.return_value = [
            {
                "id": "req-1",
                "student_id": "stud-1",
                "component_id": "comp-1",
                "quantity": 5,
                "status": "pending",
                "component_name": "ESP32",
                "available_stock": 10,
                "student_email": "stud@test.com",
                "student_name": "Student A"
            }
        ]

        # Simulate constraint failure thrown from SQLite during batch execution
        mock_db_batch.side_effect = Exception("SQLite3: constraint failed (NOT NULL constraint failed: components.id)")

        response = self.client.post("/api/requests/req-1/approve", json={"reviewed_by": "fac-1", "notes": "approve"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("stock depleted or insufficient stock", response.json()["detail"].lower())

if __name__ == "__main__":
    unittest.main()
