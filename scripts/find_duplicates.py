import re

def main():
    emails = {}
    with open("database/migrations/turso_profiles_clean.sql", "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line.startswith("INSERT INTO profiles"):
                continue
            # Find the email value. In our insert, columns are in this order:
            # ("id", "firebase_uid", "full_name", "role", "department", "phone", "register_number", 
            # "created_at", "updated_at", "is_active", "email", "faculty_id", "roll_number", "institution", "year_of_study")
            # Email is index 10 (11th column).
            match = re.search(r"VALUES\s*\((.*)\);$", line, re.IGNORECASE)
            if match:
                vals_str = match.group(1)
                # Parse values respecting single quotes
                tokens = []
                current = []
                in_string = False
                i = 0
                while i < len(vals_str):
                    c = vals_str[i]
                    if c == "'":
                        if in_string and i + 1 < len(vals_str) and vals_str[i+1] == "'":
                            current.append("''")
                            i += 2
                            continue
                        else:
                            in_string = not in_string
                            current.append("'")
                            i += 1
                            continue
                    elif c == ',' and not in_string:
                        tokens.append("".join(current).strip())
                        current = []
                        i += 1
                        continue
                    else:
                        current.append(c)
                        i += 1
                tokens.append("".join(current).strip())
                
                email = tokens[10].strip("'").lower()
                id_val = tokens[0].strip("'")
                name_val = tokens[2].strip("'")
                
                if email != "null" and email != "":
                    if email in emails:
                        emails[email].append((line_num, id_val, name_val))
                    else:
                        emails[email] = [(line_num, id_val, name_val)]
                        
    duplicates = {email: info for email, info in emails.items() if len(info) > 1}
    if duplicates:
        print(f"Found {len(duplicates)} duplicate emails:")
        for email, info in duplicates.items():
            print(f"Email: {email}")
            for item in info:
                print(f"  Line {item[0]}: ID={item[1]}, Name={item[2]}")
    else:
        print("No duplicate emails found!")

if __name__ == "__main__":
    main()
