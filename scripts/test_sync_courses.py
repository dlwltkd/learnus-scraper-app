import requests
import json

BASE_URL = "http://localhost:8000"

def test_sync_courses():
    print("Testing /sync/courses...")
    try:
        # Assuming we are already logged in or session.json is valid for the backend
        response = requests.post(f"{BASE_URL}/sync/courses")
        if response.status_code == 200:
            print("Success:", response.json())
        else:
            print("Failed:", response.status_code, response.text)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_sync_courses()
