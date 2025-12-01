import sys
import os
# Add parent directory to path to import moodle_client
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from moodle_client import MoodleClient

def main():
    client = MoodleClient("https://ys.learnus.org")
    if not client.load_session("session.json"):
        print("Failed to load session")
        return

    course_id = 277509
    print(f"Fetching https://ys.learnus.org/course/view.php?id={course_id}...")
    url = f"https://ys.learnus.org/course/view.php?id={course_id}"
    response = client.session.get(url)
    html = response.text
    
    if html:
        filename = f"course_{course_id}.html"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Saved to {filename}")
    else:
        print("Failed to fetch HTML")

if __name__ == "__main__":
    main()
