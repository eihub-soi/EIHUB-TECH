import re
import json

def reconstruct():
    with open('backend/app.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find where approve_request starts
    start_idx = content.find('@app.post("/api/requests/{id}/approve")')
    # Find where update_purchase_order starts
    end_idx = content.find('@app.put("/api/purchase-orders/{po_id}")')
    
    if start_idx == -1 or end_idx == -1:
        print("Could not find boundaries")
        return

    # The reconstructed endpoints
    reconstructed = """@app.post("/api/requests/{id}/approve")
async def approve_request(id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    faculty_id = data.get("reviewed_by")
    remark = data.get("notes", "")
    pdf_base64 = data.get("pdf_base64")
    
    reqs = await db_query('''
        SELECT r.*, c.name as component_name, c.available_stock, s.email as student_email, s.full_name as student_name
        FROM requests r
        JOIN components c ON r.component_id = c.id
        JOIN profiles s ON r.student_id = s.id
        WHERE r.id = ?
    ''', [id])
    if not reqs:
        raise HTTPException(status_code=404, detail="Request not found")
        
    req = reqs[0]
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending requests can be approved")
        
    if req["available_stock"] < req["quantity"]:
        raise HTTPException(status_code=400, detail="Cannot approve: stock depleted")
        
    app_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    req_code = f"REQ-{id[:8].upper()}"
    
    stmt1 = Statement(
        '''
        UPDATE requests 
        SET status = 'approved', reviewed_by = ?, reviewed_at = ?, reject_reason = ?
        WHERE id = ? AND status = 'pending' AND (
            SELECT available_stock FROM components WHERE id = requests.component_id
        ) >= quantity
        ''',
        [faculty_id, app_at, remark, id]
    )
    
    stmt2 = Statement(
        '''
        UPDATE components 
        SET available_stock = available_stock - ?, updated_at = datetime('now') 
        WHERE id = ? AND EXISTS (
            SELECT 1 FROM requests WHERE id = ? AND status = 'approved' AND reviewed_at = ?
        )
        ''',
        [req["quantity"], req["component_id"], id, app_at]
    )
    
    await log_activity(user["uid"], user["name"], "APPROVE_REQUEST", "REQUEST", id, {"code": req_code, "component": req["component_name"], "remark": remark}, "success")
    await db_batch([stmt1, stmt2])
    
    await add_notification(req["student_id"], "Request Approved", f"Your request for {req['quantity']}x {req['component_name']} has been approved.", "success", "/student/requests")
    
    if req.get("student_email") and pdf_base64:
        html = f"<p>Your request {req_code} has been approved.</p>"
        await EMAIL_QUEUE.put((req["student_email"], f"Request Approved ({req_code})", html, [{"content": pdf_base64, "name": f"{req_code}_Receipt.pdf"}]))
    
    await REQUESTS_CACHE.clear()
    await COMPONENTS_CACHE.clear()
    return {"id": id, "status": "approved"}

@app.post("/api/requests/{id}/reject")
async def reject_request(id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    faculty_id = data.get("reviewed_by")
    reason = data.get("reason", "")
    
    reqs = await db_query('''
        SELECT r.*, c.name as component_name, s.email as student_email, s.full_name as student_name
        FROM requests r
        JOIN components c ON r.component_id = c.id
        JOIN profiles s ON r.student_id = s.id
        WHERE r.id = ?
    ''', [id])
    
    if not reqs:
        raise HTTPException(status_code=404, detail="Request not found")
        
    req = reqs[0]
    app_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    req_code = f"REQ-{id[:8].upper()}"
    
    stmt1 = Statement(
        '''
        UPDATE requests 
        SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, reject_reason = ?
        WHERE id = ? AND status = 'pending'
        ''',
        [faculty_id, app_at, reason, id]
    )
    
    await log_activity(user["uid"], user["name"], "REJECT_REQUEST", "REQUEST", id, {"code": req_code, "component": req["component_name"], "reason": reason}, "warning")
    await db_batch([stmt1])
    
    await add_notification(req["student_id"], "Request Rejected", f"Your request for {req['quantity']}x {req['component_name']} was rejected.", "warning", "/student/requests")
    await REQUESTS_CACHE.clear()
    return {"id": id, "status": "rejected"}

@app.post("/api/requests/{id}/return-request")
async def return_request(id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    notes = data.get("notes", "")
    reqs = await db_query('''
        SELECT r.quantity, r.status, c.name FROM requests r 
        JOIN components c ON r.component_id = c.id 
        WHERE r.id = ?
    ''', [id])
    if not reqs:
        raise HTTPException(status_code=404, detail="Request not found")
        
    req = reqs[0]
    app_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    
    stmt1 = Statement(
        '''
        UPDATE requests
        SET return_requested_at = ?, reject_reason = ?
        WHERE id = ? AND status != 'returned'
        ''',
        [app_at, notes, id]
    )
    
    await log_activity(user["uid"], user["name"], "RETURN_REQUESTED", "REQUEST", id, {"component": req["name"]}, "info")
    await db_batch([stmt1])
    await REQUESTS_CACHE.clear()
    return {"id": id, "status": "return-requested"}

@app.post("/api/requests/{id}/return-process")
async def return_process_request(id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    faculty_id = data.get("reviewed_by")
    notes = data.get("notes", "")
    
    reqs = await db_query('''
        SELECT r.*, c.name as component_name, c.total_stock, c.available_stock, s.email as student_email, s.full_name as student_name
        FROM requests r
        JOIN components c ON r.component_id = c.id
        JOIN profiles s ON r.student_id = s.id
        WHERE r.id = ?
    ''', [id])
    
    if not reqs:
        raise HTTPException(status_code=404, detail="Request not found")
        
    req = reqs[0]
    app_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    
    stmt1 = Statement(
        '''
        UPDATE requests
        SET status = 'returned', returned_at = ?, return_reviewed_by = ?, reject_reason = ?
        WHERE id = ? AND status != 'returned'
        ''',
        [app_at, faculty_id, notes, id]
    )
    
    stmt2 = Statement(
        '''
        UPDATE components
        SET available_stock = MIN(total_stock, available_stock + ?), updated_at = datetime('now')
        WHERE id = ? AND EXISTS (
            SELECT 1 FROM requests WHERE id = ? AND status = 'returned' AND returned_at = ?
        )
        ''',
        [req["quantity"], req["component_id"], id, app_at]
    )
    
    await log_activity(user["uid"], user["name"], "RETURN_PROCESSED", "REQUEST", id, {"component": req["component_name"]}, "success")
    await db_batch([stmt1, stmt2])
    
    await add_notification(req["student_id"], "Return Processed", f"Your return for {req['component_name']} has been processed.", "success", "/student/requests")
    
    await REQUESTS_CACHE.clear()
    await COMPONENTS_CACHE.clear()
    return {"id": id, "status": "returned"}

@app.get("/api/profiles")
async def get_profiles():
    rows = await db_query('SELECT * FROM profiles ORDER BY created_at DESC')
    # Since we are removing D1 persistence for users_auth, we just return profiles
    # Actually, sync logic for profiles might still be needed if the UI relies on it, 
    # but the user said "remove _auth_users" not profiles.
    return rows

@app.post("/api/profiles/sync")
async def sync_profile(data: dict = Body(...), user: dict = Depends(get_current_user)):
    return {"status": "success", "message": "Profiles sync is deprecated in favor of Firebase directly, or just handled here"}

@app.get("/api/profiles/{id}")
async def get_profile_by_id(id: str):
    rows = await db_query('SELECT * FROM profiles WHERE id = ?', [id])
    if not rows:
        raise HTTPException(404, "Profile not found")
    return rows[0]

@app.get("/api/activity-logs")
async def get_activity_logs():
    return list(reversed(in_memory_activity_logs))

@app.get("/api/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    return [n for n in reversed(in_memory_notifications) if n["user_id"] == user["uid"]]

@app.post("/api/notifications/{id}/read")
async def read_notification(id: str, user: dict = Depends(get_current_user)):
    for n in in_memory_notifications:
        if n["id"] == id and n["user_id"] == user["uid"]:
            n["is_read"] = True
    return {"status": "success"}

@app.post("/api/notifications/read-all")
async def read_all_notifications(user: dict = Depends(get_current_user)):
    for n in in_memory_notifications:
        if n["user_id"] == user["uid"]:
            n["is_read"] = True
    return {"status": "success"}

@app.get("/api/purchase-orders")
async def get_purchase_orders():
    rows = await db_query('SELECT * FROM purchase_orders ORDER BY created_at DESC')
    return rows

@app.post("/api/purchase-orders")
async def create_purchase_order(data: dict = Body(...), user: dict = Depends(get_current_user)):
    po_id = str(uuid.uuid4())
    po_number = data.get("po_number")
    supplier_name = data.get("supplier_name")
    component_id = data.get("component_id")
    component_name = data.get("component_name")
    component_category = data.get("component_category", "Electronics")
    quantity = int(data.get("quantity", 1))
    unit_cost = float(data.get("unit_cost", 0.0))
    total_cost = quantity * unit_cost
    invoice_ref = data.get("invoice_ref", "")
    cabinet = data.get("cabinet", "")
    shelf = data.get("shelf", "")
    
    stmt1 = Statement(
        '''
        INSERT INTO purchase_orders (id, po_number, supplier_name, component_id, component_name, component_category, quantity, unit_cost, total_cost, purchased_by, purchased_by_name, invoice_ref, cabinet, shelf, status, purchased_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'delivered', datetime('now'), datetime('now'))
        ''',
        [po_id, po_number, supplier_name, component_id, component_name, component_category, quantity, unit_cost, total_cost, user["uid"], user["name"], invoice_ref, cabinet, shelf]
    )
    
    stmt2 = Statement(
        '''
        UPDATE components 
        SET total_stock = total_stock + ?, available_stock = available_stock + ?, updated_at = datetime('now')
        WHERE id = ?
        ''',
        [quantity, quantity, component_id]
    )
    
    await log_activity(user["uid"], user["name"], "PURCHASE_STOCK", "COMPONENT", po_id, {"po_number": po_number, "component": component_name, "qty": quantity}, "success")
    
    await db_batch([stmt1, stmt2])
    
    await COMPONENTS_CACHE.clear()
    return {"id": po_id, "po_number": po_number}

"""

    new_content = content[:start_idx] + reconstructed + content[end_idx:]
    
    with open('backend/app.py', 'w', encoding='utf-8') as f:
        f.write(new_content)

reconstruct()
