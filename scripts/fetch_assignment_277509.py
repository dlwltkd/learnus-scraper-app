import sys
import os

# Add parent directory to path to import moodle_client
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from moodle_client import MoodleClient

client = MoodleClient("https://ys.learnus.org", session_file='session.json')
url = "https://ys.learnus.org/mod/assign/view.php?id=4151557"

print(f"Fetching {url}...")
try:
    response = client.session.get(url)
    response.raise_for_status()
    with open("assignment_277509.html", "w", encoding="utf-8") as f:
        f.write(response.text)
    print("assignment_277509.html")
except Exception as e:
    print(f"Error: {e}")
