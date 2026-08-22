import re
import sys

def modify_app_py():
    with open('backend/app.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Update log_activity helper
    log_activity_replacement = """in_memory_activity_logs = CappedList(max_size=5000)

async def log_activity(user_id: Optional[str], user_name: Optional[str], action: str, entity_type: str, entity_id: Optional[str], details: dict, severity: str = "info"):
    log_id = str(uuid.uuid4())
    details_str = json.dumps(details)
    created_at_iso = datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    in_memory_activity_logs.append({
        "id": log_id,
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "severity": severity,
        "ip_address": "127.0.0.1",
        "created_at": created_at_iso
    })
    print(f"[Activity Log] {action} on {entity_type} {entity_id} by {user_name} ({severity})")"""

    content = re.sub(
        r'async def log_activity\(user_id: Optional\[str\].*?await db_execute\(sql, \[.*?\]\)',
        log_activity_replacement,
        content,
        flags=re.DOTALL
    )

    # 2. Update get_activity_logs endpoint
    get_activity_replacement = """async def get_activity_logs():
    return list(reversed(in_memory_activity_logs))"""
    
    content = re.sub(
        r'async def get_activity_logs\(\):.*?return \[clean_row\("activity_logs", r\) for r in rows\]',
        get_activity_replacement,
        content,
        flags=re.DOTALL
    )

    # 3. Clean row replacements
    content = re.sub(
        r'    elif table_name == "notifications":\s*if "is_read" in cleaned and cleaned\["is_read"\] is not None:\s*cleaned\["is_read"\] = bool\(cleaned\["is_read"\]\)',
        '',
        content
    )
    content = re.sub(
        r'    elif table_name == "activity_logs":\s*if "details" in cleaned and isinstance\(cleaned\["details"\], str\):\s*try:\s*cleaned\["details"\] = json.loads\(cleaned\["details"\]\)\s*except Exception:\s*pass',
        '',
        content
    )

    # 4. Remove direct auth users deletions and updates
    content = re.sub(r'# Update local _auth_users if email changed\s+await db_execute\(\s*"""\s*UPDATE _auth_users SET email = \? WHERE email = \?\s*""",\s*\[req\.email\.lower\(\)\.strip\(\), existing\[0\]\["email"\]\]\s*\)', '', content, flags=re.DOTALL)
    
    content = re.sub(r'# 2\. Delete credentials from _auth_users table if exists\s+await db_execute\("DELETE FROM _auth_users WHERE email = \?", \[email\.lower\(\)\.strip\(\)\]\)', '', content, flags=re.DOTALL)
    
    # 5. Remove manual INSERT INTO activity_logs inside app.py routes
    # This involves finding Statement(...) blocks wrapping INSERT INTO activity_logs.
    # We will regex them and replace with await log_activity(...)
    # Typical block:
    # log_id = str(uuid.uuid4())
    # details_str = json.dumps({"name": name, "qty": total_stock})
    # stmt2 = Statement(
    #     """
    #     INSERT INTO activity_logs (id, user_id, user_name, action, entity_type, entity_id, details, severity, ip_address, created_at)
    #     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    #     """,
    #     [log_id, user["uid"], user["name"], "CREATE_COMPONENT", "COMPONENT", comp_id, details_str, "info", "127.0.0.1"]
    # )
    
    pattern = r'(\s+)(log_id = str\(uuid\.uuid4\(\)\)\s+details_str = json\.dumps\((.*?)\)\s+stmt\d = Statement\(\s*"""\s*INSERT INTO activity_logs.*?VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, datetime\(\'now\'\)\)\s*""",\s*\[log_id, (.*?), (.*?), (.*?), (.*?), (.*?), details_str, (.*?), "127\.0\.0\.1"\]\s*\))'
    
    def replacer(match):
        indent = match.group(1)
        details = match.group(3)
        user_id = match.group(4)
        user_name = match.group(5)
        action = match.group(6)
        entity_type = match.group(7)
        entity_id = match.group(8)
        severity = match.group(9)
        return f'{indent}await log_activity({user_id}, {user_name}, {action}, {entity_type}, {entity_id}, {details}, {severity})'
        
    content = re.sub(pattern, replacer, content, flags=re.DOTALL)
    
    # Also handle the db_batch() calls that contained those stmt references.
    # Example: await db_batch([stmt1, stmt2]) -> await db_batch([stmt1])
    # Assuming stmt1 is the actual insert/update.
    # It might be `await db_batch([stmt1, stmt2, stmt3])` where stmt2 is activity and stmt3 is notification.
    # Actually wait, they might have manually defined `stmt1`, `stmt2` everywhere. Let's just fix up the lists carefully.
    
    with open('backend/app.py', 'w', encoding='utf-8') as f:
        f.write(content)
        
modify_app_py()
