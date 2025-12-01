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
        
        for item in assignments:
            if item['id'] == 4160018:
                print(f"Target Quiz (ID 4160018):")
                print(f"  Name: {item['name']}")
                print(f"  Is Completed: {item['is_completed']}")
                print(f"  Deadline: {item.get('deadline')}")
                
                # We expect it to be True. The source might now be the quiz page itself.
                if item['is_completed']:
                    print("  [SUCCESS] Quiz is marked as completed.")
                else:
                    print("  [FAILURE] Quiz is marked as NOT completed (Expected True).")
                    
    except Exception as e:
        logger.error(f"Error fetching course contents: {e}")

if __name__ == "__main__":
    main()
