import sys
import os
import json

# Add parent directory to path to import moodle_client
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from moodle_client import MoodleClient

def main():
    # Load credentials
    try:
        with open('credentials.json', 'r') as f:
            creds = json.load(f)
            username = creds.get('username')
            password = creds.get('password')
    except Exception as e:
        print(f"Could not load credentials: {e}")
        return

    client = MoodleClient("https://ys.learnus.org")
    
    print(f"Attempting login for {username}...")
    try:
        client.login(username, password)
        print("Login successful (or at least no error raised).")
        
        # Save session for other scripts
        client.save_session()
        print("Session saved to session.json")
        
        # Fetch course
        course_id = 281751
        print(f"Fetching course {course_id}...")
        url = f"{client.base_url}/course/view.php?id={course_id}"
        response = client.session.get(url)
        response.raise_for_status()
        
        filename = f"temp_data/course_{course_id}_fresh.html"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(response.text)
            
        print(f"Saved to {filename}")
        
    except Exception as e:
        print(f"Login/Fetch failed: {e}")

if __name__ == "__main__":
    main()
