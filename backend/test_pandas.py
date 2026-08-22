import pandas as pd
import numpy as np

# Simulate the exact code from import_data.py
df = pd.DataFrame({
    'name': ['Resistor 10k', None, 'None', np.nan, ' ']
})

df = df.replace({np.nan: None})
df['name'] = df['name'].astype(str).str.strip().str.replace(r'\s+', ' ', regex=True).str.title().replace("None", "")

for idx, row in df.iterrows():
    row_dict = row.to_dict()
    print(f"Row {idx}: {repr(row_dict.get('name'))}, boolean: {not row_dict.get('name')}")
