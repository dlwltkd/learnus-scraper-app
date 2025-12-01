import os
import sys
import io
import logging
import json
from datetime import datetime

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
        
        vods = contents.get('vods', [])
        print(f"Found {len(vods)} VODs.")
        
        for item in vods:
            print(f"ID: {item['id']}, Name: {item['name']}")
            print(f"  Is Completed: {item['is_completed']}")
            print(f"  Start Date: {item.get('start_date')}")
            print(f"  End Date: {item.get('end_date')}")
            print(f"  Has Tracking: {item.get('has_tracking')}")
            print("-" * 20)
            
    except Exception as e:
        logger.error(f"Error fetching course contents: {e}")

if __name__ == "__main__":
    main()
