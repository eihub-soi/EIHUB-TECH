import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Backgrounds
    content = re.sub(r'bg-(slate|navy)-([89]00|950)(\/[0-9]+)?', r'bg-white', content)
    content = re.sub(r'bg-\[\#(0B132B|070B19|1C2541)\]', r'bg-white', content)
    
    # Text
    content = re.sub(r'text-white(\/[0-9]+)?', r'text-black', content)
    content = re.sub(r'text-slate-(50|100|200|300)', r'text-black', content)
    content = re.sub(r'text-slate-(400|500)', r'text-gray-700', content)
    
    # Accents (Subtle panels, highlights)
    content = re.sub(r'bg-white\/(5|10|20)', r'bg-[#E6F0FF]', content)
    content = re.sub(r'bg-slate-(700|800)\/(40|50|60)', r'bg-[#E6F0FF]', content)
    content = re.sub(r'bg-indigo-(500|600)\/(10|20|30)', r'bg-[#E6F0FF]', content)
    content = re.sub(r'bg-brand-(500|600)\/(10|20|30)', r'bg-[#E6F0FF]', content)

    # Borders
    content = re.sub(r'border-white\/(10|20|30)', r'border-[#E5E7EB]', content)
    content = re.sub(r'border-slate-(700|800|900)(\/[0-9]+)?', r'border-[#E5E7EB]', content)
    
    # Primary actions (Buttons, icons, active nav)
    content = re.sub(r'bg-indigo-(500|600|700)', r'bg-[#60A5FA]', content)
    content = re.sub(r'bg-brand-(500|600|700)', r'bg-[#60A5FA]', content)
    content = re.sub(r'text-indigo-(400|500|600)', r'text-[#60A5FA]', content)
    content = re.sub(r'text-brand-(400|500|600)', r'text-[#60A5FA]', content)
    content = re.sub(r'border-indigo-(400|500|600)(\/[0-9]+)?', r'border-[#60A5FA]', content)
    
    # Hover states
    content = re.sub(r'hover:bg-slate-(700|800|900)(\/[0-9]+)?', r'hover:bg-[#E6F0FF]', content)
    content = re.sub(r'hover:bg-white\/[0-9]+', r'hover:bg-[#E6F0FF]', content)
    content = re.sub(r'hover:text-white', r'hover:text-black', content)
    content = re.sub(r'hover:bg-indigo-(400|500|600)(\/[0-9]+)?', r'hover:bg-[#3B82F6]', content) 

    # Focus
    content = re.sub(r'focus:border-indigo-(400|500|600)', r'focus:border-[#60A5FA]', content)
    content = re.sub(r'focus:ring-indigo-(400|500|600)', r'focus:ring-[#60A5FA]', content)

    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

modified_count = 0
for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            if process_file(os.path.join(root, file)):
                modified_count += 1
                
print(f"Modified {modified_count} files.")
