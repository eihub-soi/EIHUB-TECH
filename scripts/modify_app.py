import re

def clean_app_py():
    with open('backend/app.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Modify clean_row
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

    # 2. Modify get_activity_logs
    content = re.sub(
        r'async def get_activity_logs\(\):.*?return \[clean_row\("activity_logs", r\) for r in rows\]',
        r'async def get_activity_logs():\n    return list(reversed(in_memory_activity_logs))',
        content,
        flags=re.DOTALL
    )

    # 3. Modify log_activity helper
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

    # 4. Remove all INSERT INTO activity_logs (stmt assignments) and db_batch logic involving them
    # This is a bit tricky, let's just do it programmatically using a custom function that removes stmtX if it contains activity_logs.
    lines = content.split('\n')
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        
        if "UPDATE _auth_users SET email = ?" in line:
            # Skip the line and the preceding log/comment
            if new_lines[-1].strip().startswith("# Update local _auth_users"):
                new_lines.pop()
            i += 1
            continue
            
        if "DELETE FROM _auth_users WHERE email" in line:
            if new_lines[-1].strip().startswith("# 2. Delete credentials"):
                new_lines.pop()
            i += 1
            continue
            
        if 'INSERT INTO activity_logs' in line:
            # We found an INSERT INTO activity_logs. It's likely inside a Statement(...).
            # We want to remove the entire Statement(...) assignment.
            # We look backwards to find `stmtX = Statement(` and delete from there.
            start_idx = len(new_lines) - 1
            while start_idx >= 0 and not new_lines[start_idx].strip().startswith("stmt"):
                if new_lines[start_idx].strip().startswith("details_str") or new_lines[start_idx].strip().startswith("log_id"):
                    pass # We also remove log_id and details_str assignments if we want, but let's just leave them or pop them
                start_idx -= 1
                
            stmt_var = None
            if start_idx >= 0:
                stmt_var = new_lines[start_idx].strip().split(' ')[0] # e.g. stmt2
                
            # Now we pop until start_idx, and we also look for `log_id` and `details_str` right before start_idx to pop them too
            if stmt_var:
                new_lines = new_lines[:start_idx]
                while len(new_lines) > 0 and (new_lines[-1].strip().startswith("log_id =") or new_lines[-1].strip().startswith("details_str =")):
                    new_lines.pop()
                    
            # Skip ahead until the end of the Statement block (closing parenthesis for Statement)
            paren_count = 1
            j = i + 1
            while j < len(lines):
                paren_count += lines[j].count('(') - lines[j].count(')')
                if paren_count <= 0: # found end of Statement block
                    i = j
                    break
                j += 1
                
            # Now we need to append a call to log_activity. We can extract the arguments from the Statement if we want, 
            # but it's simpler to just do the db_batch removal and log_activity insertion manually or via regex if we can.
            # Actually, to make it super robust, it's safer to just let the backend NOT call log_activity for these redundant ones,
            # or extract the args. Let's try to extract the args from the `[log_id, ...]` array!
        else:
            new_lines.append(line)
        i += 1
        
    with open('backend/app_test.py', 'w', encoding='utf-8') as f:
        f.write("\n".join(new_lines))

clean_app_py()
