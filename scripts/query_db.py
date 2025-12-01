from database import init_db, Post, Board, Course
import sys

# Force UTF-8 for printing content
sys.stdout.reconfigure(encoding='utf-8')

def get_most_recent_post():
    # 1. Connect to the database
    # Make sure to use the same db name as you used in verify_db.py or your main app
    Session = init_db('learnus_test.db')
    session = Session()
    
    try:
        # 2. Query Posts, order by date descending, and take the first one
        # Note: Since date is YYYY-MM-DD string, string sorting works for dates.
        recent_post = session.query(Post).order_by(Post.date.desc()).first()
        
        if recent_post:
            print(f"=== Most Recent Post ===")
            print(f"Title:   {recent_post.title}")
            print(f"Date:    {recent_post.date}")
            print(f"Writer:  {recent_post.writer}")
            print(f"Board:   {recent_post.board.title}")
            print(f"Course:  {recent_post.board.course.name}")
            print("-" * 30)
            print("Content Preview:")
            print( recent_post.content)
        else:
            print("No posts found in the database.")
            
    finally:
        session.close()

if __name__ == "__main__":
    get_most_recent_post()
