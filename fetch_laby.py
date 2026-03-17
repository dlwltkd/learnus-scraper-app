import sys
sys.path.insert(0, '/app')

from database import init_db, User
from api import get_moodle_client
import re

SessionLocal = init_db()
db = SessionLocal()

user = db.query(User).filter(User.moodle_username == '631292').first()
if not user or not user.moodle_cookies:
    user = db.query(User).filter(User.moodle_cookies.isnot(None), User.moodle_cookies != '').first()

print(f"Using user: {user.username}")
client = get_moodle_client(user)

# Step 1: fetch laby viewer to get the redirect URL
r = client.session.get("https://ys.learnus.org/mod/laby/viewer.php?i=5254")
print(f"Laby viewer status: {r.status_code}")

# Extract the redirect URL from the JS
match = re.search(r'location\.href\s*=\s*"([^"]+)"', r.text)
if not match:
    print("Could not find redirect URL")
    exit(1)

external_url = match.group(1)
print(f"External player URL: {external_url[:100]}...")

# Step 2: fetch the external player
r2 = client.session.get(external_url)
print(f"External player status: {r2.status_code}")
print(f"Final URL: {r2.url}")

with open("/app/laby_external_player.html", "w", encoding="utf-8") as f:
    f.write(r2.text)
print("Saved to /app/laby_external_player.html")
db.close()
