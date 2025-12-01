from moodle_client import MoodleClient
from database import init_db
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

SessionLocal = init_db()
db = SessionLocal()
client = MoodleClient("https://ys.learnus.org", session_file='session.json')
course_id = 277509

print(f"Syncing course {course_id}...")
try:
    summary = client.sync_course_to_db(course_id, db)
    print(summary)
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
