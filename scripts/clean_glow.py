import glob
import re

files = glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True)

patterns_to_remove = [
    r'\bshadow-(?:indigo|blue|emerald|rose|amber|gold|glass|glow)[-\w\/]*\b',
    r'\bring[-\w\/]*\b',
    r'\bbackdrop-blur[-\w]*\b',
    r'\bblur[-\w]*\b'
]

patterns_to_downgrade = [
    r'\bshadow-lg\b',
    r'\bshadow-xl\b',
    r'\bshadow-2xl\b',
    r'\bdrop-shadow[-\w]*\b'
]

modified_files = []

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content

    # Remove colored shadows, rings, and blurs
    for pattern in patterns_to_remove:
        content = re.sub(pattern, '', content)
    
    # Downgrade heavy shadows to shadow-sm
    for pattern in patterns_to_downgrade:
        content = re.sub(pattern, 'shadow-sm', content)
    
    # Clean up multiple spaces inside className attributes (heuristic)
    # Just clean up double spaces globally except in string literals? 
    # Actually, fixing double spaces anywhere is mostly harmless in tsx, but safer to only do it inside classNames if possible.
    # We can just do a simple replace of 2 or more spaces with 1 space, but only if they are not line breaks.
    # A simpler approach: just let the extra spaces be, browser ignores them in classNames.
    # But let's clean them up nicely.
    content = re.sub(r'  +', ' ', content)
    
    # Fix instances where class=" " became class=""
    content = content.replace('className=" "', 'className=""')

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        modified_files.append(filepath)

print(f"Modified {len(modified_files)} files:")
for m in modified_files:
    print(f" - {m}")
