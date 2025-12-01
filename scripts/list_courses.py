import requests
import sys
import os
import json
import logging

# Add parent directory to path to import moodle_client
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from moodle_client import MoodleClient
sys.stdout.reconfigure(encoding='utf-8')

def list_courses():
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

    print("Fetching course list...")
    try:
        courses = client.get_courses()
        print(f"\nFound {len(courses)} courses:")
        for course in courses:
            print(f"- [{course['id']}] {course['fullname']}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_courses()
