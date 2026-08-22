import os
import re

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return False
        
    original = content
    
    # Case insensitive replacement
    content = re.sub(r'School of Innovation', 'School of Innovation', content, flags=re.IGNORECASE)
    
    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Modified: {filepath}")
        return True
    return False

modified_count = 0
exclude_dirs = {'.git', 'node_modules', '.venv', '__pycache__', '.pytest_cache'}

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.md', '.py', '.sql', '.toml')):
            filepath = os.path.join(root, file)
            if process_file(filepath):
                modified_count += 1

print(f"Total files modified: {modified_count}")
