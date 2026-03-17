from database import SessionLocal, User
from moodle_client import MoodleClient
import json

db = SessionLocal()
user = db.query(User).filter(User.moodle_username == 'moodle_631292').first()
if not user:
    print("User not found")
    exit(1)

cookies = json.loads(user.moodle_cookies)
client = MoodleClient("https://ys.learnus.org", cookies=cookies)

r = client.session.get("https://ys.learnus.org/mod/laby/viewer.php?i=5254")
print(f"Status: {r.status_code}")

with open("/app/laby_viewer.html", "w", encoding="utf-8") as f:
    f.write(r.text)
print("Saved to /app/laby_viewer.html")
