import re

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update useState for regDepartment
content = re.sub(
    r"const \[regDepartment, setRegDepartment\] = useState\([^)]+\);",
    "const [regDepartment, setRegDepartment] = useState('');",
    content
)

# 2. Update useState for regYear
content = re.sub(
    r"const \[regYear, setRegYear\] = useState\([^)]+\);",
    "const [regYear, setRegYear] = useState('');",
    content
)

# 3. Update isRegFormInvalid validation
validation_pattern = r"(const isRegFormInvalid =\s+!regFullName\.trim\(\) \|\|\s+isRegEmailInvalid \|\|\s+!regPassword \|\|)"
new_validation = r"const isRegFormInvalid =\n    !regFullName.trim() ||\n    !regDepartment ||\n    !regYear ||\n    isRegEmailInvalid ||\n    !regPassword ||"
content = re.sub(validation_pattern, new_validation, content)

# 4. Department Options Replacement
dept_pattern = r"(<select\s+value=\{regDepartment\}.*?>\s*)<option value=\"Electronics & Instrumentation Engineering \(EIE\)\">.*?<\/option>"
content = re.sub(dept_pattern, r'\1<option value="">-- Select Department --</option>', content, flags=re.DOTALL)

# Add CYS at the end of the department list (before </select>)
cys_pattern = r"(<option value=\"Robotics & Automation \(R&A\)\">.*?<\/option>\s*)<\/select>"
content = re.sub(cys_pattern, r'\1<option value="Cyber Security (CYS)">Cyber Security (CYS)</option>\n                      </select>', content, flags=re.DOTALL)

# 5. Year Options Replacement
year_pattern = r"(<select\s+value=\{regYear\}.*?>\s*)(<option value=\"1st Year\">)"
content = re.sub(year_pattern, r'\1<option value="">-- Select Year --</option>\n                        \2', content, flags=re.DOTALL)

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)
