import logging
from moodle_client import MoodleClient
from database import init_db, Course, Assignment, VOD, Board, Post
import sys

# Force UTF-8
sys.stdout.reconfigure(encoding='utf-8')

logging.basicConfig(level=logging.INFO)

def test_db():
    # Initialize DB
    Session = init_db('learnus_test.db')
    session = Session()
    
    # Initialize Client
    client = MoodleClient("https://ys.learnus.org", session_file='session.json')
    if not client.sesskey:
        print("Session load failed")
        return

    course_id = 276615
    print(f"Syncing course {course_id} to DB...")
    
    try:
        client.sync_course_to_db(course_id, session)
        
        # Verify Data
        print("\n=== Verification ===")
        
        # Check Course
        course = session.query(Course).filter_by(id=course_id).first()
        if course:
            print(f"Course: {course.name} (ID: {course.id})")
            
            # Check Assignments
            assign_count = session.query(Assignment).filter_by(course_id=course_id).count()
            print(f"Assignments: {assign_count}")
            
            # Check VODs
            vod_count = session.query(VOD).filter_by(course_id=course_id).count()
            print(f"VODs: {vod_count}")
            
            # Check Boards and Posts
            boards = session.query(Board).filter_by(course_id=course_id).all()
            print(f"Boards: {len(boards)}")
            for b in boards:
                post_count = session.query(Post).filter_by(board_id=b.id).count()
                print(f"  - {b.title}: {post_count} posts")
                
                # Check content of one post
                if post_count > 0:
                    first_post = session.query(Post).filter_by(board_id=b.id).first()
                    print(f"    * Sample Post: {first_post.title}")
                    print(f"    * Content Length: {len(first_post.content) if first_post.content else 0}")

    except Exception as e:
        print(f"Sync failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    test_db()
