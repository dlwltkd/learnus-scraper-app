from moodle_client import MoodleClient
import json

client = MoodleClient("https://ys.learnus.org", session_file='session.json')
course_id = 277509

print(f"Fetching assignments for course {course_id}...")
try:
    assignments = client.get_assignments(course_id)
    with open("assignments_277509.txt", "w", encoding="utf-8") as f:
        f.write(f"Found {len(assignments)} assignments.\n")
        for a in assignments:
            f.write(f"ID: {a['id']}, Name: {a['name']}, URL: https://ys.learnus.org/mod/assign/view.php?id={a['id']}\n")
except Exception as e:
    print(f"Error: {e}")
