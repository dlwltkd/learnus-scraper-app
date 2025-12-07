import logging
import time
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from database import init_db, User, Course, Board, Post
from moodle_client import MoodleClient
from ai_service import AIService

from exponent_server_sdk import PushClient, PushMessage

SessionLocal = init_db()

# Setup Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Watcher")

# Helper to get client for user
def get_client(user: User):
    client = MoodleClient(user.username, user.password)
    # Restore session if available
    if user.moodle_cookies:
        client.set_cookies(user.moodle_cookies)
        # Check validity? Only if needed.
        # if not client.is_session_valid(): login...
    else:
        # Full login
        if not client.login(user.username, user.password):
            logger.error(f"Failed to login user {user.username}")
    return client

def send_push_notification(user: User, course: Course, post: Post):
    try:
        # Use AI to summarize the post content
        ai = AIService()
        msg_body = ai.summarize_text(post.content or post.title)
        
        # Fallback if AI fails or returns empty/too long (though logic inside handles it)
        if not msg_body:
            msg_body = post.title
        
        try:
             res = PushClient().publish(
                PushMessage(
                    to=user.push_token,
                    sound="default",
                    title=f"📢 {course.name}",
                    body=msg_body,
                    data={
                        "type": "notice",
                        "postId": post.id,
                        "courseId": course.id
                    }
                )
             )
             print(f"✅ Expo Response: {res}") # DEBUG PRINT
        except Exception as exc:
            logger.error(f"Expo Send Error: {exc}")
            print(f"❌ Expo Send Error: {exc}") # DEBUG PRINT

        logger.info(f"Sent push to {user.username} for post {post.id}")
    except Exception as e:
        logger.error(f"Failed to send push: {e}")


def process_user_notices(user: User, db: Session):
    try:
        client = get_client(user)
        # 1. Quick Auth Check (Optional, but good)
        if not user.moodle_cookies: return

        # 2. Get Active Courses
        courses = db.query(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()
        
        for course in courses:
            # Find 'Notice' board
            board = db.query(Board).filter(Board.course_id == course.id, Board.title.like('%공지%')).first()
            if not board: continue
            
            # 3. Capture current max ID to detect new ones
            max_id_row = db.query(Post.id).filter(Post.board_id == board.id).order_by(Post.id.desc()).first()
            old_max_id = max_id_row[0] if max_id_row else 0
            
            # 4. Sync ONLY this board (We need to add sync_board to MoodleClient or emulate it)
            # For now, we reuse sync_course_to_db but that is heavy. 
            # Let's assume we implement a lightweight check or just accept the overhead for now (it's per user).
            # To avoid scraping 10 courses every 5 mins per user, we should ideally check the "Recent Activity" API if Moodle has one.
            # But sticking to scraping:
            
            # Workaround: Just check the first page of the board.
            posts_data = client.get_board_posts(board.moodle_id) # Returns list of dicts
            
            new_posts_found = []
            
            for p_data in posts_data:
                # Check if exists in DB by moodle_id comparison? 
                # Our Post model doesn't strictly enforce moodle_id unique constraint globally but usually we filter by board.
                # Actually Post model doesn't have moodle_id column in previous `database.py` view! 
                # It has `url`, `title`, `date`. Moodle doesn't always expose easy IDs for posts.
                # We often dedup by Title + Date + Writer.
                
                exists = db.query(Post).filter(
                    Post.board_id == board.id, 
                    Post.title == p_data['title'],
                    Post.date == p_data['date']
                ).first()
                
                if not exists:
                    # Create it
                    new_post = Post(
                        board_id=board.id,
                        title=p_data['title'],
                        writer=p_data['writer'],
                        date=p_data['date'],
                        url=p_data['url'],
                        content="" # Content fetched later if needed? Or get_board_posts gets it?
                    )
                    # If get_board_posts doesn't get content, we might want to fetch it for AI summary.
                    # fetch detail
                    detail = client.get_post_detail(p_data['url'])
                    new_post.content = detail.get('content', '')
                    
                    db.add(new_post)
                    db.commit() # Commit to get an ID
                    db.refresh(new_post)
                    new_posts_found.append(new_post)
            
            # 5. Notify
            for post in new_posts_found:
                send_push_notification(user, course, post)

    except Exception as e:
        # logger.error(f"Error processing user {user.username}: {e}")
        pass

def check_notices_job(SessionLocal):
    """
    Runs every 5 minutes.
    Checks for NEW posts in 'Notices' boards for all active users.
    """
    # logger.info("Running Check Notices Job...")
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.push_token.isnot(None)).all()
        for user in users:
            process_user_notices(user, db)
    except Exception as e:
        logger.error(f"Check Notices Job Failed: {e}")
    finally:
        db.close()

def sync_dashboard_job(SessionLocal):
    """
    Runs every 60 minutes.
    Full Sync.
    """
    logger.info("Running Hourly Full Sync Job...")
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active == True).all() # Or active only?
        for user in users:
             try:
                client = get_client(user)
                # We can reuse the `sync_all_active_courses` logic from API but we need to import or replicate.
                # Simplest is to replicate loop:
                courses = db.query(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()
                for course in courses:
                     # This logic exists in api.py's `sync_course_task`. 
                     # Ideally we refactor `sync_course_to_db` out of API and into `services/` or `moodle_client`.
                     # For now, let's just log placeholder.
                     pass 
             except: pass
    finally:
        db.close()
