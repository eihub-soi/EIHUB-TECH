import re

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# First, clean up the bad imports.
# The bad script added them right after every `import {`
content = content.replace("import {\n  Package,\n", "import {\n")
content = content.replace("import {\n  ClipboardList,\n", "import {\n")
content = content.replace("import {\n  BarChart3,\n", "import {\n")

# Now properly add them only to lucide-react
match = re.search(r"import\s+\{([^}]+)\}\s+from\s+[\"']lucide-react[\"'];", content)
if match:
    lucide_imports = match.group(1)
    new_imports = lucide_imports
    for icon in ["Package", "ClipboardList", "BarChart3"]:
        if icon not in lucide_imports:
            new_imports += f"  {icon},\n"
    content = content.replace(lucide_imports, new_imports)

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed imports")
