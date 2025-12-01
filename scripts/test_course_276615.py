import logging
from moodle_client import MoodleClient
import json
import sys

# Configure logging
logging.basicConfig(level=logging.INFO)
sys.stdout.reconfigure(encoding='utf-8')

def test_course_contents():
    # Load credentials/session
    try:
        with open('credentials.json', 'r') as f:
            creds = json.load(f)
    except FileNotFoundError:
        print("credentials.json not found")
        return

    base_url = "https://ys.learnus.org"
    client = MoodleClient(base_url, username=creds.get('username'), password=creds.get('password'))
    
    # Load session
    try:
        client.load_session('session.json')
    except Exception as e:
        print(f"Failed to load session: {e}")
        return

    # Test Course ID (Computing Research Introduction)
    course_id = 276615
    
    print(f"Fetching contents for course {course_id}...")
    try:
        contents = client.get_course_contents(course_id)
        
        print("\n=== Announcements ===")
        for item in contents['announcements']:
            print(f"- [{item['date']}] {item['subject']}")

        print("\n=== Boards ===")
        for item in contents['boards']:
            print(f"- {item['name']} (ID: {item['id']})")
            # Fetch posts for this board
            try:
                posts = client.get_board_posts(item['id'])
                for i, post in enumerate(posts):
                    print(f"  * [{post['date']}] {post['subject']} ({post['writer']})")
                    # Fetch content for the first post only to test
                    if i == 0:
                        content = client.get_post_content(post['url'])
                        print(f"    Content Preview: {content[:100]}...")
            except Exception as e:
                print(f"  ! Failed to fetch posts: {e}")
            
        print("\n=== Assignments ===")
        for item in contents['assignments']:
            status = "[x]" if item['is_completed'] else "[ ]"
            deadline = f" | Due: {item.get('deadline_text')}" if item.get('deadline_text') else ""
            print(f"{status} {item['name']} (ID: {item['id']}){deadline}")

        print("\n=== Files ===")
        for item in contents['files']:
            status = "[x]" if item['is_completed'] else "[ ]"
            print(f"{status} {item['name']} (ID: {item['id']})")
            
        print("\n=== VODs ===")
        for item in contents['vods']:
            status = "[x]" if item['is_completed'] else "[ ]"
            deadline = f" | End: {item.get('end_date')}" if item.get('end_date') else ""
            print(f"{status} {item['name']} (ID: {item['id']}){deadline}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_course_contents()
