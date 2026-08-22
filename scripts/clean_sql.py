import re

with open('eihub_backup.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 1. Remove Postgres specific SET commands
sql = re.sub(r"SET session_replication_role.*?;", "", sql)

# 2. Remove TRUNCATE TABLE / DELETE FROM
sql = re.sub(r"TRUNCATE TABLE .*? CASCADE;", "", sql)
sql = re.sub(r"DELETE FROM [a-zA-Z0-9_]+;", "", sql)

# 3. Remove public. prefix
sql = sql.replace("public.", "")

# 4. Remove ::jsonb typecasts
sql = re.sub(r"::jsonb", "", sql)

with open('eihub_backup_clean.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print("Cleaned SQL written to eihub_backup_clean.sql")
