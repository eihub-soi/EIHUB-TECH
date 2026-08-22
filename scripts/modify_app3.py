import re

def fix_app():
    with open('backend/app.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace log_activity
    content = re.sub(
        r'async def log_activity\(user_id.*?await db_execute\(sql, \[.*?\]\)',
        r'''in_memory_activity_logs = CappedList(max_size=5000)

async def log_activity(user_id: Optional[str], user_name: Optional[str], action: str, entity_type: str, entity_id: Optional[str], details: dict, severity: str = "info"):
    log_id = str(uuid.uuid4())
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
    print(f"[Activity Log] {action} on {entity_type} {entity_id} by {user_name} ({severity})")''',
        content,
        flags=re.DOTALL
    )

    # Replace get_activity_logs
    content = re.sub(
        r'async def get_activity_logs\(\):.*?return \[clean_row\("activity_logs", r\) for r in rows\]',
        r'async def get_activity_logs():\n    return list(reversed(in_memory_activity_logs))',
        content,
        flags=re.DOTALL
    )

    # Clean row
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

    # Auth logic
    content = re.sub(r'# Update local _auth_users if email changed\s+await db_execute\(\s*"""\s*UPDATE _auth_users SET email = \? WHERE email = \?\s*""",\s*\[req\.email\.lower\(\)\.strip\(\), existing\[0\]\["email"\]\]\s*\)', '', content, flags=re.DOTALL)
    
    content = re.sub(r'# 2\. Delete credentials from _auth_users table if exists\s+await db_execute\("DELETE FROM _auth_users WHERE email = \?", \[email\.lower\(\)\.strip\(\)\]\)', '', content, flags=re.DOTALL)

    # Remove all INSERT INTO activity_logs manually using string replacements
    pattern = r'''(\s+)log_id = str\(uuid\.uuid4\(\)\)\s+details_str = json\.dumps\((.*?)\)\s+(stmt\d) = Statement\(\s*"""\s*INSERT INTO activity_logs.*?VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, datetime\('now'\)\)\s*""",\s*\[log_id, (.*?), (.*?), (.*?), (.*?), (.*?), details_str, (.*?), "127\.0\.0\.1"\]\s*\)'''

    def replacer(m):
        indent = m.group(1)
        details = m.group(2)
        stmt_var = m.group(3)
        user_id = m.group(4)
        user_name = m.group(5)
        action = m.group(6)
        entity_type = m.group(7)
        entity_id = m.group(8)
        severity = m.group(9)
        # We need to preserve stmt_var because it is used in db_batch.
        # But wait, if it's used in db_batch([stmt1, stmt2]), and we remove stmt2, we can just assign None to stmt2, and filter the list!
        # Or even better, just leave a dummy statement like "SELECT 1" so it doesn't break.
        return f'{indent}{stmt_var} = Statement("SELECT 1")\n{indent}await log_activity({user_id}, {user_name}, {action}, {entity_type}, {entity_id}, {details}, {severity})'

    content = re.sub(pattern, replacer, content, flags=re.DOTALL)

    with open('backend/app.py', 'w', encoding='utf-8') as f:
        f.write(content)

fix_app()
