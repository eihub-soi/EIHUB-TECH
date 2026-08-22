import ast

with open('../backend/app.py', 'r', encoding='utf-8') as f:
    tree = ast.parse(f.read())

for node in tree.body:
    if isinstance(node, ast.ClassDef):
        print(f"Class: {node.name}")
    elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        decorators = []
        for d in node.decorator_list:
            if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute):
                if hasattr(d.func.value, 'id'):
                    decorators.append(f"@{d.func.value.id}.{d.func.attr}")
                else:
                    decorators.append(f"@{d.func.attr}")
            elif isinstance(d, ast.Name):
                decorators.append(f"@{d.id}")
            elif isinstance(d, ast.Attribute):
                if hasattr(d.value, 'id'):
                    decorators.append(f"@{d.value.id}.{d.attr}")
        
        dec_str = ", ".join(decorators)
        if dec_str:
            print(f"Function: {node.name} ({dec_str})")
        else:
            print(f"Function: {node.name}")
