import re

def parse_values(val_str):
    tokens = []
    current = []
    in_string = False
    i = 0
    while i < len(val_str):
        c = val_str[i]
        if c == "'":
            if in_string and i + 1 < len(val_str) and val_str[i+1] == "'":
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
    return tokens

def main():
    input_file = "database/migrations/turso_profiles.sql"
    output_file = "database/migrations/turso_profiles_clean.sql"
    
    # Indexes of columns to keep:
    # 0: id, 1: firebase_uid, 2: full_name, 3: role, 4: department, 5: phone, 6: register_number, 
    # 9: created_at, 10: updated_at, 11: is_active, 12: email, 13: faculty_id, 14: roll_number, 15: institution, 17: year_of_study
    keep_indices = [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 17]
    
    columns_declaration = (
        '("id", "firebase_uid", "full_name", "role", "department", "phone", "register_number", '
        '"created_at", "updated_at", "is_active", "email", "faculty_id", "roll_number", "institution", "year_of_study")'
    )
    
    cleaned_lines = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            if line.startswith("DELETE FROM"):
                cleaned_lines.append(line)
                continue
            
            # Match: INSERT INTO profiles (...) VALUES (...);
            match = re.search(r"VALUES\s*\((.*)\);$", line, re.IGNORECASE)
            if match:
                vals_str = match.group(1)
                tokens = parse_values(vals_str)
                filtered_tokens = [tokens[idx] for idx in keep_indices]
                new_vals = ", ".join(filtered_tokens)
                cleaned_lines.append(
                    f"INSERT INTO profiles {columns_declaration} VALUES ({new_vals});"
                )
            else:
                cleaned_lines.append(line)
                
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(cleaned_lines) + "\n")
        
    print(f"Cleaned SQL written to {output_file}")

if __name__ == "__main__":
    main()
