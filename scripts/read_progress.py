
import sys

with open('mod_vod.js', 'r', encoding='utf-8') as f:
    f.seek(885000)
    content = f.read(5000)
    # Print using repr to avoid encoding errors in terminal
    print(content.encode('utf-8', errors='replace').decode('utf-8'))
