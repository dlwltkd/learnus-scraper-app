import requests

def test_login():
    url = "http://localhost:8000/login"
    payload = {"cookie_string": "test=cookie"}
    try:
        print("Sending request...")
        resp = requests.post(url, json=payload, timeout=5)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_login()
