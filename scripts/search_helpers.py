
import re

with open('mod_vod.js', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File length: {len(content)}")

# Search for c.ajax definition
ajax_matches = re.finditer(r"c\.ajax\s*=\s*function", content)
for match in ajax_matches:
    start = match.start()
    end = min(len(content), start + 1000)
    print(f"Found 'c.ajax' at {start}:")
    print(content[start:end])
    print("-" * 20)

# Search for c.trackForWindow definition
track_matches = re.finditer(r"c\.trackForWindow\s*=\s*function", content)
for match in track_matches:
    start = match.start()
    end = min(len(content), start + 1000)
    print(f"Found 'c.trackForWindow' at {start}:")
    print(content[start:end])
    print("-" * 20)
