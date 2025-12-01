import sys
import os

# Add parent directory to path to import moodle_client
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from moodle_client import MoodleClient

client = MoodleClient("https://ys.learnus.org", session_file='session.json')
course_id = 279348
url = f"https://ys.learnus.org/course/view.php?id={course_id}"

print(f"Fetching {url}...")
try:
    response = client.session.get(url)
    response.raise_for_status()
    with open("course_279348.html", "w", encoding="utf-8") as f:
        f.write(response.text)
    print("Saved to course_279348.html")
except Exception as e:
    print(f"Error: {e}")
