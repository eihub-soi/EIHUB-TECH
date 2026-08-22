import sys
import os
import unittest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

# Ensure backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))

class TestBackendProduction(unittest.TestCase):
    def setUp(self):
        # Prevent actual database connections or background tasks during startup override
        pass

    @patch('app.main.db_query', new_callable=AsyncMock)
    def test_get_profile_unauthenticated(self, mock_query):
        from app.main import app
        client = TestClient(app)
        
        # Call without auth header / token
        response = client.get("/api/profiles")
        # Since Firebase Authentication is not overridden, it fails with 401
        self.assertEqual(response.status_code, 401)

    @patch('app.main.db_query', new_callable=AsyncMock)
    def test_get_profile_authenticated_success(self, mock_query):
        from app.main import app, get_current_user
        
        # Override get_current_user dependency
        mock_user = {"uid": "usr-student-123", "email": "student@kgisl.com", "role": "student", "name": "Test Student"}
        app.dependency_overrides[get_current_user] = lambda: mock_user
        
        # Mock database response for the user
        mock_query.return_value = [{
            "id": "usr-student-123",
            "firebase_uid": "usr-student-123",
            "email": "student@kgisl.com",
            "full_name": "Test Student",
            "role": "student",
            "created_at": "2026-08-18T00:00:00Z"
        }]
        
        client = TestClient(app)
        response = client.get("/api/profiles")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], "usr-student-123")
        self.assertEqual(data["email"], "student@kgisl.com")
        self.assertEqual(data["full_name"], "Test Student")
        
        app.dependency_overrides.clear()

    @patch('app.main.db_query', new_callable=AsyncMock)
    def test_get_profile_by_id_forbidden(self, mock_query):
        from app.main import app, get_current_user
        
        # Override current user as a student
        mock_user = {"uid": "usr-student-123", "email": "student@kgisl.com", "role": "student"}
        app.dependency_overrides[get_current_user] = lambda: mock_user
        
        client = TestClient(app)
        # Attempt to access another user's profile (usr-student-999)
        response = client.get("/api/profiles/usr-student-999")
        
        # Should be forbidden (403)
        self.assertEqual(response.status_code, 403)
        
        app.dependency_overrides.clear()

    @patch('app.main.db_query', new_callable=AsyncMock)
    def test_get_profile_by_id_allowed_admin(self, mock_query):
        from app.main import app, get_current_user
        
        # Override current user as admin
        mock_user = {"uid": "usr-admin-1", "email": "admin@kgisl.com", "role": "admin"}
        app.dependency_overrides[get_current_user] = lambda: mock_user
        
        # Mock database response
        mock_query.return_value = [{
            "id": "usr-student-999",
            "email": "other@kgisl.com",
            "full_name": "Other Student",
            "role": "student"
        }]
        
        client = TestClient(app)
        response = client.get("/api/profiles/usr-student-999")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], "usr-student-999")
        
        app.dependency_overrides.clear()

if __name__ == "__main__":
    unittest.main()
