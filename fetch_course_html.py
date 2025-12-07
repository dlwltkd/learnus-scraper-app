
import logging
from moodle_client import MoodleClient
import json
import os

# Setup logging
logging.basicConfig(level=logging.INFO)

# Load credentials
with open('credentials.json', 'r') as f:
    creds = json.load(f)

USERNAME = creds['username']
PASSWORD = creds['password']
BASE_URL = "https://ys.learnus.org"
COURSE_URL = "https://ys.learnus.org/course/view.php?id=282403"
OUTPUT_FILE = "temp_data/282403_class.html"


def fetch_and_save():
    client = MoodleClient(BASE_URL)
    
    print(f"Logging in as {USERNAME}...")
    try:
        # Manually perform login to debug
        login_url = f"{client.base_url}/login/index.php"
        response = client.session.get(login_url, timeout=10)
        
        # Save pre-login page
        with open('temp_data/login_pre.html', 'w', encoding='utf-8') as f:
            f.write(response.text)
            
        match = client.get_sesskey(response.text) # Just checking if sesskey exists (unlikely before login)
        
        # Extract logintoken
        import re
        match = re.search(r'<input type="hidden" name="logintoken" value="([^"]+)">', response.text)
        logintoken = match.group(1) if match else ""
        print(f"Logintoken found: {logintoken[:10]}...")
        
        payload = {'username': USERNAME, 'password': PASSWORD, 'logintoken': logintoken}
        response = client.session.post(login_url, data=payload, timeout=10)
        
        # Save post-login page
        with open('temp_data/login_post.html', 'w', encoding='utf-8') as f:
            f.write(response.text)
            
        if "login/logout.php" in response.text:
            print("Login successful (found logout link).")
        else:
            print("Login failed (no logout link). Check temp_data/login_post.html")
            return

    except Exception as e:
        print(f"Login process error: {e}")
        return

    print(f"Fetching {COURSE_URL}...")
    try:
        response = client.session.get(COURSE_URL)
        response.raise_for_status()
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(response.text)
            
        print(f"Saved HTML to {OUTPUT_FILE} ({len(response.text)} bytes)")
        
    except Exception as e:
        print(f"Failed to fetch course page: {e}")

if __name__ == "__main__":
    fetch_and_save()
