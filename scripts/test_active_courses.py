import requests
import json

BASE_URL = "http://localhost:8000"

def test_active_courses():
    print("Testing Active Courses Feature...")
    
    # 1. Get Courses
    print("Fetching courses...")
    resp = requests.get(f"{BASE_URL}/courses")
    if resp.status_code != 200:
        print("Failed to fetch courses")
        return
    
    courses = resp.json()
    if not courses:
        print("No courses found. Sync first.")
        return
        
    target_course = courses[0]
    print(f"Target Course: {target_course['id']} ({target_course['name']}) - Active: {target_course.get('is_active')}")
    
    # 2. Toggle Inactive
    print("Setting to Inactive...")
    resp = requests.put(f"{BASE_URL}/courses/{target_course['id']}/active", json={"is_active": False})
    print("Update Response:", resp.json())
    
    # 3. Verify
    resp = requests.get(f"{BASE_URL}/courses")
    updated_courses = resp.json()
    updated_target = next(c for c in updated_courses if c['id'] == target_course['id'])
    print(f"Verified Status: {updated_target.get('is_active')}")
    
    if updated_target.get('is_active') is False:
        print("SUCCESS: Course set to inactive.")
    else:
        print("FAILURE: Course status did not change.")
        
    # 4. Revert
    print("Reverting to Active...")
    requests.put(f"{BASE_URL}/courses/{target_course['id']}/active", json={"is_active": True})
    print("Reverted.")

if __name__ == "__main__":
    test_active_courses()
