import re

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Main Background
code = code.replace('bg-[#0B132B]', 'bg-slate-50')
code = code.replace('text-slate-100', 'text-slate-900')

# 2. Main Card
code = code.replace('bg-slate-900/80', 'bg-white')
code = code.replace('border-white/15', 'border-slate-200')
code = code.replace('shadow-2xl', 'shadow-xl')

# 3. Headers and text
code = code.replace('text-white', 'text-slate-900')
code = code.replace('text-slate-300', 'text-slate-700')
code = code.replace('text-slate-400', 'text-slate-500')

# 4. Inputs
code = code.replace('glass-input', 'bg-white border border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20')
code = code.replace('bg-slate-950/40', 'bg-slate-100')

# 5. Role Cards
code = code.replace('bg-slate-950/20', 'bg-slate-50')
code = code.replace('border-white/5', 'border-slate-200')
code = code.replace('text-blue-400', 'text-blue-700')
code = code.replace('text-emerald-400', 'text-emerald-700')
code = code.replace('text-purple-400', 'text-purple-700')
code = code.replace('text-blue-300', 'text-blue-800')
code = code.replace('text-emerald-300', 'text-emerald-800')
code = code.replace('text-purple-300', 'text-purple-800')
code = code.replace('text-slate-500', 'text-slate-600')

# 6. Auth Mode Selector
code = code.replace('bg-slate-950/80', 'bg-slate-100')
code = code.replace('border-white/10', 'border-slate-200')

# 7. Brand Logo
code = code.replace('bg-slate-950', 'bg-white')
code = code.replace('border-white/20', 'border-slate-200')
code = code.replace('ring-indigo-500/30', 'ring-indigo-500/10')

# 8. Modals / specific elements
code = code.replace('bg-slate-950/85', 'bg-slate-900/40')
code = code.replace('bg-slate-900/90', 'bg-white')
code = code.replace('placeholder:text-slate-500', 'placeholder:text-slate-400')

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "w", encoding="utf-8") as f:
    f.write(code)
