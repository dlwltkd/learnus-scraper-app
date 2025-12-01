import requests

url = "http://127.0.0.1:8000/sync/all-active"

try:
    # Try with empty body
    print("Attempt 1: Empty body")
    response = requests.post(url)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Try with empty JSON
    print("\nAttempt 2: Empty JSON")
    response = requests.post(url, json={})
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

except Exception as e:
    print(f"Error: {e}")
