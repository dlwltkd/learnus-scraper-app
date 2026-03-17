import sys
sys.path.insert(0, '/app')

from database import init_db, User
from api import get_moodle_client
import re
import requests

SessionLocal = init_db()
db = SessionLocal()

user = db.query(User).filter(User.moodle_username == '631292').first()
if not user or not user.moodle_cookies:
    user = db.query(User).filter(User.moodle_cookies.isnot(None), User.moodle_cookies != '').first()

print(f"Using user: {user.username}")
client = get_moodle_client(user)

# Step 1: fetch laby viewer to get redirect URL
r = client.session.get("https://ys.learnus.org/mod/laby/viewer.php?i=5254")
match = re.search(r'location\.href\s*=\s*"([^"]+)"', r.text)
external_url = match.group(1)
print(f"External URL: {external_url[:120]}")

# Step 2: fetch external player page
r2 = requests.get(external_url)
print(f"External player status: {r2.status_code}")

# Find all JS src files loaded
js_files = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', r2.text)
print(f"\nJS files loaded:")
for js in js_files:
    print(f"  {js}")

# Step 3: fetch each JS file and save
base = "https://alrs.yonsei.ac.kr"
for js in js_files:
    if 'jquery' in js.lower():
        continue
    url = js if js.startswith('http') else base + js
    print(f"\nFetching: {url}")
    try:
        rjs = requests.get(url, timeout=10)
        filename = js.split('/')[-1].split('?')[0]
        path = f"/app/laby_js_{filename}"
        with open(path, "w", encoding="utf-8") as f:
            f.write(rjs.text)
        print(f"  Saved {len(rjs.text)} chars to {path}")
    except Exception as e:
        print(f"  Failed: {e}")

db.close()
