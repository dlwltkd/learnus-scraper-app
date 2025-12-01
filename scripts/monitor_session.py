import time
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from moodle_client import MoodleClient

SESSION_FILE = 'session.json'

def main():
    print(f"Monitoring {SESSION_FILE} for changes...")
    last_mtime = os.path.getmtime(SESSION_FILE)
    
    while True:
        try:
            current_mtime = os.path.getmtime(SESSION_FILE)
            if current_mtime != last_mtime:
                print(f"\n[!] Session file updated at {time.ctime(current_mtime)}")
                last_mtime = current_mtime
                
                # Try to list courses to verify session validity
                print("Verifying session...")
                try:
                    client = MoodleClient("https://ys.learnus.org", session_file=SESSION_FILE)
                    courses = client.get_courses()
                    if courses:
                        print(f"SUCCESS! Found {len(courses)} courses.")
                        for c in courses:
                            print(f"- {c['fullname']} ({c['id']})")
                        break
                    else:
                        print("Session updated but still found 0 courses. (Maybe scraping failed?)")
                except Exception as e:
                    print(f"Session check failed: {e}")
                    
            time.sleep(1)
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(1)

if __name__ == "__main__":
    main()
