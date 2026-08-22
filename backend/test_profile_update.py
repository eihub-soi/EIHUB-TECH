import sys
import os
import unittest
from unittest.mock import patch, AsyncMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

# Ensure backend and backend/app directories are in the path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))

class TestProfileUpdate(unittest.TestCase):
    def setUp(self):
        from app.main import app
        self.client = TestClient(app)

    @patch('app.main.db_query', new_callable=AsyncMock)
    @patch('app.main.db_execute', new_callable=AsyncMock)
    @patch('firebase_admin.auth.update_user')
    def test_update_profile_admin_success(self, mock_fb_update, mock_db_execute, mock_db_query):
        from app.main import app, get_current_user
        
        # Current user is admin
        mock_user = {"uid": "usr-admin-1", "email": "admin@kgkite.ac.in", "role": "admin"}
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Existing profile to update
        mock_db_query.side_effect = [
            # 1. Check profile existence
            [{
                "id": "usr-student-999",
                "firebase_uid": "usr-student-999",
                "email": "student@kgkite.ac.in",
                "full_name": "Old Student",
                "role": "student",
                "department": "ECE",
                "phone": "+919999999999",
                "is_active": 1,
                "username": "student@kgkite.ac.in"
            }],
            # 2. Check duplicate email query
            [],
            # 3. Check duplicate username query
            [],
            # 4. Get updated profile query
            [{
                "id": "usr-student-999",
                "firebase_uid": "usr-student-999",
                "email": "newstudent@kgkite.ac.in",
                "full_name": "New Student Name",
                "role": "student",
                "department": "CSE",
                "phone": "+918888888888",
                "is_active": 1,
                "username": "newstudent@kgkite.ac.in"
            }]
        ]

        payload = {
            "email": "newstudent@kgkite.ac.in",
            "full_name": "New Student Name",
            "role": "student",
            "department": "CSE",
            "phone": "+918888888888",
            "register_number": "711721106001",
            "roll_number": "21EC001",
            "institution": "KITE",
            "year_of_study": "4th Year",
            "is_active": True,
            "username": "newstudent@kgkite.ac.in"
        }

        response = self.client.put("/api/profiles/usr-student-999", json=payload)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["full_name"], "New Student Name")
        self.assertEqual(data["user"]["email"], "newstudent@kgkite.ac.in")
        self.assertEqual(data["user"]["role"], "student")
        
        app.dependency_overrides.clear()

    @patch('app.main.db_query', new_callable=AsyncMock)
    def test_update_profile_student_forbidden_role_change(self, mock_db_query):
        from app.main import app, get_current_user
        
        # Current user is student attempting privilege escalation
        mock_user = {"uid": "usr-student-999", "email": "student@kgkite.ac.in", "role": "student"}
        app.dependency_overrides[get_current_user] = lambda: mock_user

        mock_db_query.return_value = [{
            "id": "usr-student-999",
            "firebase_uid": "usr-student-999",
            "email": "student@kgkite.ac.in",
            "full_name": "Old Student",
            "role": "student",
            "is_active": 1,
            "username": "student@kgkite.ac.in"
        }]

        # Trying to change role to admin
        payload = {
            "email": "student@kgkite.ac.in",
            "full_name": "Old Student",
            "role": "admin",
            "is_active": True,
            "username": "student@kgkite.ac.in"
        }

        response = self.client.put("/api/profiles/usr-student-999", json=payload)
        self.assertEqual(response.status_code, 403)
        
        app.dependency_overrides.clear()

    @patch('app.main.db_query', new_callable=AsyncMock)
    def test_update_profile_invalid_domain(self, mock_db_query):
        from app.main import app, get_current_user
        
        # Admin trying to set an invalid email domain
        mock_user = {"uid": "usr-admin-1", "email": "admin@kgkite.ac.in", "role": "admin"}
        app.dependency_overrides[get_current_user] = lambda: mock_user

        mock_db_query.return_value = [{
            "id": "usr-student-999",
            "firebase_uid": "usr-student-999",
            "email": "student@kgkite.ac.in",
            "role": "student",
            "is_active": 1
        }]

        # Invalid domain
        payload = {
            "email": "bademail@gmail.com",
            "full_name": "Test Student",
            "role": "student"
        }

        response = self.client.put("/api/profiles/usr-student-999", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Only official @kgkite.ac.in email addresses are allowed", response.json()["detail"])
        
        app.dependency_overrides.clear()

if __name__ == "__main__":
    unittest.main()
