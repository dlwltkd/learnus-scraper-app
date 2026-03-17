import sys
sys.path.insert(0, '/app')

from database import init_db, User
from api import get_moodle_client

SessionLocal = init_db()
db = SessionLocal()

# Try target user first, fall back to any user with cookies
user = db.query(User).filter(User.moodle_username == '631292').first()
if not user or not user.moodle_cookies:
    print(f"User 631292 has no cookies, finding another user...")
    user = db.query(User).filter(User.moodle_cookies.isnot(None), User.moodle_cookies != '').first()

if not user:
    print("No user with cookies found")
    db.close()
    exit(1)

print(f"Using user: {user.username} (moodle_username={user.moodle_username})")

client = get_moodle_client(user)
r = client.session.get("https://ys.learnus.org/mod/laby/viewer.php?i=5254")
print(f"Status: {r.status_code}")
print(f"URL after redirects: {r.url}")

with open("/app/laby_viewer.html", "w", encoding="utf-8") as f:
    f.write(r.text)
print("Saved to /app/laby_viewer.html")
db.close()
