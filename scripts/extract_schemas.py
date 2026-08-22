import ast
import sys

def extract_schemas(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        source = f.read()
    
    tree = ast.parse(source)
    schema_classes = []
    
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            # Check if it inherits from BaseModel
            is_pydantic = any(getattr(base, 'id', '') == 'BaseModel' for base in node.bases)
            if is_pydantic:
                schema_classes.append(node)
                
    if not schema_classes:
        return
        
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("from pydantic import BaseModel\n")
        f.write("from typing import List, Optional, Dict, Any\n\n")
        for node in schema_classes:
            f.write(ast.unparse(node) + "\n\n")

if __name__ == "__main__":
    extract_schemas("../backend/app.py", "../backend/app/schemas/models.py")
