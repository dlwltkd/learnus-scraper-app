import logging
from moodle_client import MoodleClient
import sys

# Force UTF-8
sys.stdout.reconfigure(encoding='utf-8')

logging.basicConfig(level=logging.INFO)

def test():
    client = MoodleClient("https://ys.learnus.org", session_file='session.json')
    if not client.sesskey:
        print("Session load failed")
        return

    course_id = 276615
    print(f"Fetching contents for course {course_id}...")
    
    # Get boards
    contents = client.get_course_contents(course_id)
    boards = contents['boards']
    
    for board in boards:
        print(f"\nBoard: {board['name']} (ID: {board['id']})")
        posts = client.get_board_posts(board['id'])
        print(f"Found {len(posts)} posts.")
        
        if posts:
            first_post = posts[0]
            print(f"First Post: {first_post['subject']} by {first_post['writer']}")
            content = client.get_post_content(first_post['url'])
            print(f"Content Preview: {content[:100]}...")

if __name__ == "__main__":
    test()
