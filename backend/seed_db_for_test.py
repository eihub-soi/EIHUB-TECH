import asyncio
import os
import sys
import uuid
import random
from datetime import datetime, timedelta

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv()

from app.main import db_query, get_db_client, Statement

async def seed_data():
    print("Starting database seeding...")
    
    # 1. Fetch profiles and components
    students = await db_query("SELECT id FROM profiles WHERE role = 'student'")
    faculty_list = await db_query("SELECT id FROM profiles WHERE role IN ('admin', 'faculty')")
    components = await db_query("SELECT id FROM components")
    
    if not students:
        print("No student profiles found to seed requests.")
        return
    if not faculty_list:
        print("No admin/faculty profiles found to seed requests.")
        return
    if not components:
        print("No components found to seed requests.")
        return
        
    student_ids = [s['id'] for s in students]
    faculty_ids = [f['id'] for f in faculty_list]
    component_ids = [c['id'] for c in components]
    
    print(f"Found {len(student_ids)} students, {len(faculty_ids)} faculty, {len(component_ids)} components.")
    
    # 2. Clear existing requests
    print("Clearing existing requests...")
    await db_query("DELETE FROM requests")
    
    # 3. Generate new requests
    statements = []
    
    # We want:
    # - 28 borrow transactions (status='approved', returned_at=None)
    # - 22 return transactions (status='returned', returned_at is set)
    # - 10 pending requests (status='pending')
    # - 8 rejected requests (status='rejected')
    
    statuses = (
        ['approved'] * 28 +
        ['returned'] * 22 +
        ['pending'] * 10 +
        ['rejected'] * 8
    )
    
    purposes = [
        "Final year project: Autonomous Drone navigation system.",
        "IoT Lab Session 4: ESP32 interfacing with sensors.",
        "Robotics Workshop: Line follower design.",
        "Embedded Systems class assignment.",
        "SOI Innovation Project: Smart Agriculture Monitoring.",
        "Mini project: Home automation using Google Assistant.",
        "Research work on wireless sensor networks.",
        "Testing sensor calibration in Lab A."
    ]
    
    remarks_list = [
        "Delivered in good condition.",
        "Approved for final year project.",
        "No remarks.",
        "Student registered for ECE lab.",
        "Checked by lab assistant."
    ]
    
    base_date = datetime(2026, 6, 1)
    
    for i, status in enumerate(statuses):
        req_id = str(uuid.uuid4())
        student_id = random.choice(student_ids)
        comp_id = random.choice(component_ids)
        qty = random.randint(1, 4)
        purpose = random.choice(purposes)
        
        # Spread dates from June 1st to August 15th
        days_offset = random.randint(0, 75)
        req_time = base_date + timedelta(days=days_offset, hours=random.randint(9, 17))
        requested_at = req_time.isoformat() + "Z"
        
        notes = "Requesting components for lab experiment."
        reject_reason = ""
        reviewed_by = None
        reviewed_at = None
        returned_at = None
        return_reviewed_by = None
        
        if status in ['approved', 'returned', 'rejected']:
            reviewed_by = random.choice(faculty_ids)
            reviewed_at = (req_time + timedelta(hours=random.randint(1, 4))).isoformat() + "Z"
            
        if status == 'rejected':
            reject_reason = "Required stock not available / Purpose not specified clearly."
            
        if status == 'returned':
            returned_at = (req_time + timedelta(days=random.randint(2, 10))).isoformat() + "Z"
            return_reviewed_by = random.choice(faculty_ids)
            reject_reason = "Condition reported by student: Good. Returned on time." # notes/remarks for returns are stored in reject_reason or notes
            notes = "Returned in pristine condition."
            
        sql = """
            INSERT INTO requests (
                id, student_id, component_id, quantity, status, notes, 
                reject_reason, requested_at, reviewed_by, reviewed_at, returned_at, return_reviewed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = [
            req_id, student_id, comp_id, qty, status, notes,
            reject_reason, requested_at, reviewed_by, reviewed_at, returned_at, return_reviewed_by
        ]
        statements.append(Statement(sql, params))
        
    print(f"Generated {len(statements)} requests to insert.")
    
    # Execute batch
    db_client = await get_db_client()
    # Batch updates are executed via executing statements one by one or via transaction
    # Since D1Client supports executing statements, let's execute them in a batch or one by one
    for idx, stmt in enumerate(statements):
        await db_client.execute(stmt.sql, stmt.args)
        if (idx + 1) % 10 == 0:
            print(f"Inserted {idx + 1} requests...")
            
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
