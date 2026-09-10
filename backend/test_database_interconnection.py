import unittest
import os
import sys
import asyncio
from unittest.mock import patch, MagicMock

# Add backend directory to sys.path
sys.path.append(os.path.dirname(__file__))

from app.main import app, db_query, db_execute, db_batch, Statement, get_current_user, require_faculty_or_admin, require_admin

class TestDatabaseInterconnection(unittest.TestCase):
    """
    Verifies that all entities (Profiles, Components, Requests, Purchase Orders, Notifications)
    are interconnected via Foreign Keys / IDs and stored persistently in the database.
    """

    def setUp(self):
        import asyncio
        async def init_test_tables():
            await db_execute("DROP TABLE IF EXISTS profiles")
            await db_execute("DROP TABLE IF EXISTS components")
            await db_execute("DROP TABLE IF EXISTS requests")
            await db_execute("DROP TABLE IF EXISTS purchase_orders")
            await db_execute("DROP TABLE IF EXISTS notifications")
            await db_execute("DROP TABLE IF EXISTS reminder_logs")

            await db_execute("""
                CREATE TABLE profiles (
                    id VARCHAR(255) PRIMARY KEY,
                    firebase_uid VARCHAR(255),
                    email VARCHAR(255) UNIQUE,
                    full_name VARCHAR(255),
                    role VARCHAR(255),
                    department VARCHAR(255),
                    phone VARCHAR(255),
                    is_active INTEGER DEFAULT 1,
                    created_at VARCHAR(255)
                )
            """)

            await db_execute("""
                CREATE TABLE components (
                    id VARCHAR(255) PRIMARY KEY,
                    sku VARCHAR(255),
                    name VARCHAR(255),
                    category VARCHAR(255),
                    description TEXT,
                    total_stock INTEGER DEFAULT 0,
                    available_stock INTEGER DEFAULT 0,
                    borrowed_stock INTEGER DEFAULT 0,
                    unit_cost REAL DEFAULT 0.0,
                    location VARCHAR(255),
                    image_url VARCHAR(255),
                    unit VARCHAR(50),
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
                    requested_at VARCHAR(255),
                    reviewed_by VARCHAR(255),
                    reviewed_at VARCHAR(255),
                    reject_reason TEXT,
                    return_requested_at VARCHAR(255),
                    returned_at VARCHAR(255),
                    FOREIGN KEY (student_id) REFERENCES profiles(id),
                    FOREIGN KEY (component_id) REFERENCES components(id)
                )
            """)

            await db_execute("""
                CREATE TABLE purchase_orders (
                    id VARCHAR(255) PRIMARY KEY,
                    po_number VARCHAR(255),
                    supplier_name VARCHAR(255),
                    component_id VARCHAR(255),
                    component_name VARCHAR(255),
                    quantity INTEGER,
                    unit_cost REAL,
                    total_cost REAL,
                    status VARCHAR(255),
                    purchased_at VARCHAR(255),
                    FOREIGN KEY (component_id) REFERENCES components(id)
                )
            """)

            await db_execute("""
                CREATE TABLE notifications (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id VARCHAR(255),
                    title VARCHAR(255),
                    message TEXT,
                    type VARCHAR(255),
                    is_read INTEGER DEFAULT 0,
                    link_url VARCHAR(255),
                    created_at VARCHAR(255),
                    FOREIGN KEY (user_id) REFERENCES profiles(id)
                )
            """)

        asyncio.run(init_test_tables())

    def test_interconnected_database_lifecycle(self):
        async def run_lifecycle():
            # 1. Create Student Profile in DB
            await db_execute(
                "INSERT INTO profiles (id, firebase_uid, email, full_name, role, department) VALUES (?, ?, ?, ?, ?, ?)",
                ["stud-db-1", "fb-uid-stud-1", "student1@kgkite.ac.in", "Student One", "student", "ECE"]
            )
            # Verify Profile stored in DB
            prof = await db_query("SELECT * FROM profiles WHERE id = ?", ["stud-db-1"])
            self.assertEqual(len(prof), 1)
            self.assertEqual(prof[0]["full_name"], "Student One")

            # 2. Create Component in DB
            await db_execute(
                "INSERT INTO components (id, sku, name, category, total_stock, available_stock, unit_cost, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ["comp-db-1", "ESP-32-SKU", "ESP32 Dev Module", "Microcontrollers", 10, 10, 450.0, "Rack A1"]
            )
            comp = await db_query("SELECT * FROM components WHERE id = ?", ["comp-db-1"])
            self.assertEqual(len(comp), 1)
            self.assertEqual(comp[0]["available_stock"], 10)

            # 3. Create Interconnected Borrow Request (Student -> Component)
            await db_execute(
                "INSERT INTO requests (id, student_id, component_id, quantity, status, requested_at) VALUES (?, ?, ?, ?, ?, ?)",
                ["req-db-1", "stud-db-1", "comp-db-1", 2, "pending", "2026-09-10T14:40:00Z"]
            )
            req = await db_query(
                "SELECT r.*, s.full_name as student_name, c.name as component_name FROM requests r JOIN profiles s ON r.student_id = s.id JOIN components c ON r.component_id = c.id WHERE r.id = ?",
                ["req-db-1"]
            )
            self.assertEqual(len(req), 1)
            self.assertEqual(req[0]["student_name"], "Student One")
            self.assertEqual(req[0]["component_name"], "ESP32 Dev Module")
            self.assertEqual(req[0]["quantity"], 2)

            # 4. Process Approval: Decrement Component Stock & Set Request Status
            stmt_req = Statement("UPDATE requests SET status = 'approved', reviewed_by = 'fac-1' WHERE id = ? AND status = 'pending'", ["req-db-1"])
            stmt_comp = Statement("UPDATE components SET available_stock = available_stock - 2 WHERE id = ?", ["comp-db-1"])
            await db_batch([stmt_req, stmt_comp])

            # Verify Component Stock updated in DB
            comp_updated = await db_query("SELECT * FROM components WHERE id = ?", ["comp-db-1"])
            self.assertEqual(comp_updated[0]["available_stock"], 8)

            # 5. Insert Notification for Student linked to Profile
            await db_execute(
                "INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                ["notif-db-1", "stud-db-1", "Request Approved", "Your loan for ESP32 was approved", "success", 0, "2026-09-10T14:41:00Z"]
            )
            notifs = await db_query("SELECT * FROM notifications WHERE user_id = ?", ["stud-db-1"])
            self.assertEqual(len(notifs), 1)
            self.assertEqual(notifs[0]["title"], "Request Approved")

            # 6. Process Purchase Order & Increase Component Stock
            await db_execute(
                "INSERT INTO purchase_orders (id, po_number, supplier_name, component_id, component_name, quantity, unit_cost, total_cost, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ["po-db-1", "PO-999", "Robu.in", "comp-db-1", "ESP32 Dev Module", 10, 400.0, 4000.0, "received"]
            )
            await db_execute("UPDATE components SET total_stock = total_stock + 10, available_stock = available_stock + 10 WHERE id = ?", ["comp-db-1"])

            comp_final = await db_query("SELECT * FROM components WHERE id = ?", ["comp-db-1"])
            self.assertEqual(comp_final[0]["total_stock"], 20)
            self.assertEqual(comp_final[0]["available_stock"], 18)

            # 7. Complete Return & Restore Stock
            stmt_return_req = Statement("UPDATE requests SET status = 'returned' WHERE id = ?", ["req-db-1"])
            stmt_return_comp = Statement("UPDATE components SET available_stock = available_stock + 2 WHERE id = ?", ["comp-db-1"])
            await db_batch([stmt_return_req, stmt_return_comp])

            comp_returned = await db_query("SELECT * FROM components WHERE id = ?", ["comp-db-1"])
            self.assertEqual(comp_returned[0]["available_stock"], 20)

        asyncio.run(run_lifecycle())

if __name__ == "__main__":
    unittest.main()
