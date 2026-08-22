import re
import codecs

# We will read and write to handle potential encoding issues
try:
    with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "r", encoding="utf-8") as f:
        content = f.read()
except UnicodeDecodeError:
    with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "r", encoding="utf-16") as f:
        content = f.read()

# 1. Update states
content = content.replace("useState('Electronics & Instrumentation Engineering (EIE)');", "useState('');")
content = content.replace("useState('3rd Year');", "useState('');")

# 2. Update validation
# The original validation starts like:
#   const isRegFormInvalid =
#     !regFullName.trim() ||
#     isRegEmailInvalid ||
old_val = "const isRegFormInvalid =\n    !regFullName.trim() ||"
new_val = "const isRegFormInvalid =\n    !regFullName.trim() ||\n    !regDepartment ||\n    !regYear ||"
content = content.replace(old_val, new_val)

# 3. Update Department dropdown options
dept_select_start = '<select\n                      value={regDepartment}'
dept_options_old = """                      >
                        <option value="Electronics & Instrumentation Engineering (EIE)">Electronics & Instrumentation (EIE)</option>
                        <option value="Electronics & Communication Engineering (ECE)">Electronics & Communication (ECE)</option>
                        <option value="Computer Science Engineering (CSE)">Computer Science (CSE)</option>
                        <option value="Information Technology (IT)">Information Technology (IT)</option>
                        <option value="Electrical & Electronics Engineering (EEE)">Electrical & Electronics (EEE)</option>
                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                        <option value="Artificial Intelligence & Data Science (AIMDS)">Artificial Intelligence & Data Science (AIMDS)</option>
                        <option value="Artificial Intelligence & Machine Learning (AIML)">Artificial Intelligence & Machine Learning (AIML)</option>
                        <option value="Computer Science & Business Systems (CSBS)">Computer Science & Business Systems (CSBS)</option>
                        <option value="Robotics & Automation (R&A)">Robotics & Automation (R&A)</option>
                      </select>"""

dept_options_new = """                      >
                        <option value="">-- Select Department --</option>
                        <option value="Electronics & Communication Engineering (ECE)">Electronics & Communication (ECE)</option>
                        <option value="Computer Science Engineering (CSE)">Computer Science (CSE)</option>
                        <option value="Information Technology (IT)">Information Technology (IT)</option>
                        <option value="Electrical & Electronics Engineering (EEE)">Electrical & Electronics (EEE)</option>
                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                        <option value="Artificial Intelligence & Data Science (AIMDS)">Artificial Intelligence & Data Science (AIMDS)</option>
                        <option value="Artificial Intelligence & Machine Learning (AIML)">Artificial Intelligence & Machine Learning (AIML)</option>
                        <option value="Computer Science & Business Systems (CSBS)">Computer Science & Business Systems (CSBS)</option>
                        <option value="Robotics & Automation (R&A)">Robotics & Automation (R&A)</option>
                        <option value="Cyber Security (CYS)">Cyber Security (CYS)</option>
                      </select>"""
content = content.replace(dept_options_old, dept_options_new)

# 4. Update Year dropdown options
year_options_old = """                      >
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                      </select>"""
year_options_new = """                      >
                        <option value="">-- Select Year --</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                      </select>"""
content = content.replace(year_options_old, year_options_new)

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)
