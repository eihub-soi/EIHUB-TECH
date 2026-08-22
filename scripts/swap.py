import re

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Extract the exact text of Username block
username_pattern = re.compile(r'(<div>\s*<label className="block text-slate-700 font-semibold mb-1">Username</label>.*?</div>\s*</div>)', re.DOTALL)
username_match = username_pattern.search(content)

# 2. Extract the exact text of Student Email ID block
email_pattern = re.compile(r'(<div>\s*<label className="block text-slate-700 font-semibold mb-1">Student Email ID</label>.*?{regEmailError && \(\s*<p className="text-rose-400 text-\[10px\] mt-1 font-bold">{regEmailError}</p>\s*\)\}\s*</div>\s*</div>)', re.DOTALL)
email_match = email_pattern.search(content)

if username_match and email_match:
    username_text = username_match.group(1)
    email_text = email_match.group(1)
    
    # We can't just replace directly because if we replace one, the indices change.
    # So we replace with placeholders first
    content = content.replace(username_text, "%%%USERNAME_PLACEHOLDER%%%")
    content = content.replace(email_text, "%%%EMAIL_PLACEHOLDER%%%")
    
    content = content.replace("%%%USERNAME_PLACEHOLDER%%%", email_text)
    content = content.replace("%%%EMAIL_PLACEHOLDER%%%", username_text)
    
    with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Swapped successfully")
else:
    print("Could not find blocks")
    if not username_match: print("Username block not found")
    if not email_match: print("Email block not found")
