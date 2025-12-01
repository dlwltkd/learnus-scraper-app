import sys
import os

# Add parent directory to path to import moodle_client
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from moodle_client import MoodleClient

def main():
    client = MoodleClient("https://ys.learnus.org", session_file='session.json')
    
    course_id = 4160018
    print(f"Fetching course {course_id}...")
    
    try:
        url = f"{client.base_url}/course/view.php?id={course_id}"
        response = client.session.get(url)
        response.raise_for_status()
        
        filename = f"temp_data/course_{course_id}.html"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(response.text)
            
        print(f"Saved to {filename}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
