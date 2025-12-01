import requests
import json
import sys

# Force UTF-8 for Windows console
sys.stdout.reconfigure(encoding='utf-8')

# LearnUs Moodle URL
BASE_URL = "https://ys.learnus.org"
TOKEN_URL = f"{BASE_URL}/login/token.php"

def test_auth_endpoint():
    """
    Tests the authentication endpoint with dummy credentials to check the response structure.
    """
    print(f"Testing connection to: {TOKEN_URL}")
    
    # Load credentials from file
    try:
        with open('credentials.json', 'r', encoding='utf-8') as f:
            creds = json.load(f)
    except FileNotFoundError:
        print("Error: credentials.json not found.")
        return
        
    payload = {
        'username': creds.get('username'),
        'password': creds.get('password'),
        'service': creds.get('service', 'moodle_mobile_app')
    }
    
    if payload['username'] == "YOUR_USERNAME_HERE":
        print("Please update credentials.json with your actual username and password.")
        return
    
    try:
        response = requests.post(TOKEN_URL, data=payload)
        print(f"Status Code: {response.status_code}")
        
        try:
            data = response.json()
            print("Response JSON:")
            # Use ensure_ascii=True to avoid encoding errors in console if reconfigure doesn't work for some reason
            print(json.dumps(data, indent=2, ensure_ascii=True))
            
            if 'error' in data:
                print("\n[SUCCESS] Endpoint returned an error as expected (invalid credentials).")
                print(f"Error: {data.get('error')}")
                print(f"Error Code: {data.get('errorcode')}")
            elif 'token' in data:
                print("\n[SURPRISE] Received a token with dummy credentials?!")
            else:
                print("\n[INFO] Received unexpected JSON structure.")
                
        except json.JSONDecodeError:
            print("Response is not JSON.")
            print(response.text[:500])
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_auth_endpoint()
