import sys
import os

# Add parent directory to path to import moodle_client
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from moodle_client import MoodleClient

def main():
    client = MoodleClient("https://ys.learnus.org", session_file='session.json')
    
    print("Fetching dashboard...")
    try:
        response = client.session.get("https://ys.learnus.org/")
        response.raise_for_status()
        
        filename = "temp_data/dashboard_debug.html"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(response.text)
            
        print(f"Saved to {filename}")
        
        if "login/index.php" in response.url or "Log in to the site" in response.text:
            print("Session appears EXPIRED/INVALID (Redirected to login)")
        else:
            print("Session appears VALID")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
