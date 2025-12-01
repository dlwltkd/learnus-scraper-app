import os
import sys
import io
import logging
import json

# Set stdout to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add parent dir to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from moodle_client import MoodleClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    base_url = "https://ys.learnus.org"
    session_file = os.path.abspath("session.json")
    
    client = MoodleClient(base_url, session_file=session_file)
    
    if not client.sesskey:
        logger.error("Failed to load session. Please login via the app first.")
        return

    course_id = 277509
    print(f"Fetching contents for course {course_id}...")
    
    try:
        contents = client.get_course_contents(course_id)
        
        assignments = contents.get('assignments', [])
        print(f"Found {len(assignments)} assignments/quizzes.")
        
        found_target_quiz = False
        
        for item in assignments:
            # Check if it looks like a quiz (based on name or if we had a type field, but we only have name/id/url/deadline now)
            # Actually get_course_contents puts quizzes in assignments but doesn't explicitly label them as quizzes in the output dict unless we check the name
            print(f"ID: {item['id']}, Name: {item['name']}")
            if 'deadline' in item:
                print(f"  Deadline: {item['deadline']}")
            else:
                print("  Deadline: None")
                
            if item['id'] == 4160018:
                found_target_quiz = True
                if item.get('deadline') == "2025-09-20 23:59":
                    print("  [SUCCESS] Target quiz deadline matches!")
                else:
                    print(f"  [FAILURE] Target quiz deadline mismatch. Expected '2025-09-20 23:59', got '{item.get('deadline')}'")

        if not found_target_quiz:
            print("[FAILURE] Target quiz (ID 4160018) not found in assignments list.")
            
    except Exception as e:
        logger.error(f"Error fetching course contents: {e}")

if __name__ == "__main__":
    main()
