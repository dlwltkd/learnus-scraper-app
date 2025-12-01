import requests
import json
import sys
import io

# Set stdout to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_URL = "http://127.0.0.1:8000"

def check_dashboard():
    print("Checking /dashboard/overview...")
    try:
        response = requests.get(f"{API_URL}/dashboard/overview")
        if response.status_code != 200:
            print(f"Failed to fetch dashboard: {response.status_code}")
            return
            
        data = response.json()
        
        # Check upcoming assignments
        upcoming = data.get('upcoming_assignments', [])
        print(f"Upcoming Assignments: {len(upcoming)}")
        for item in upcoming:
            if item['id'] == 4160018:
                print(f"  [UPCOMING] Target Quiz Found: {item['title']}")
                print(f"  Is Completed: {item['is_completed']}")
                
        # Check available VODs
        available = data.get('available_vods', [])
        print(f"Available VODs: {len(available)}")
        
        # Check missed assignments (should NOT contain completed items now)
        missed = data.get('missed_assignments', [])
        print(f"Missed Assignments: {len(missed)}")
        for item in missed:
            if item['id'] == 4160018:
                print(f"  [MISSED] Target Quiz Found: {item['title']}")
                print(f"  Is Completed: {item['is_completed']}")

    except Exception as e:
        print(f"Error checking dashboard: {e}")

def check_course_assignments(course_id):
    print(f"Checking /courses/{course_id}/assignments...")
    try:
        response = requests.get(f"{API_URL}/courses/{course_id}/assignments")
        if response.status_code != 200:
            print(f"Failed to fetch assignments: {response.status_code}")
            return
            
        data = response.json()
        print(f"Total Assignments: {len(data)}")
        
        found = False
        for item in data:
            if item['id'] == 4160018:
                found = True
                print(f"  [COURSE] Target Quiz Found: {item['title']}")
                print(f"  Is Completed: {item['is_completed']}")
                
        if not found:
            print("  Target Quiz NOT found in course assignments.")
            
    except Exception as e:
        print(f"Error checking course assignments: {e}")

if __name__ == "__main__":
    check_dashboard()
    check_course_assignments(277509)
