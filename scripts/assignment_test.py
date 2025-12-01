import logging
from moodle_client import MoodleClient
import json
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)

def test_assignments():
    # Load credentials/session
    try:
        with open('credentials.json', 'r') as f:
            creds = json.load(f)
    except FileNotFoundError:
        print("credentials.json not found")
        return

    base_url = "https://ys.learnus.org"
    client = MoodleClient(base_url, username=creds.get('username'), password=creds.get('password'))
    
    # Load session
    try:
        client.load_session('session.json')
    except Exception as e:
        print(f"Failed to load session: {e}")
        return

    # Test Course ID (Engineering Math 1)
    course_id = 279325
    
    print(f"Testing assignment retrieval for course {course_id}...")
    try:
        assignments = client.get_assignments(course_id)
        print(f"\nFound {len(assignments)} assignments:")
        for assign in assignments:
            status = "[x]" if assign['is_completed'] else "[ ]"
            print(f"{status} {assign['name']} (ID: {assign['id']})")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_assignments()
