import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import User, Course, Board, Post, init_db
from moodle_client import MoodleClient
from ai_service import AIService
# from expo_exporter import PushClient, PushMessage # We will use direct requests or expo-server-sdk
import requests
import json
from expo_push_notifications import PushClient, PushMessage 

logger = logging.getLogger(__name__)

# Mock Expo SDK for now if not installed, but we added it to requirements.
# We need to handle the case where `expo_push_notifications` wrapper isn't created yet or just use the SDK directly.
from expo_server_sdk import PushClient, PushMessage

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
    Performs a full sync (courses, assignments, vods) for all active users.
    """
    logger.info("Running Sync Dashboard Job...")
    db = SessionLocal()
    try:
        # Sync users who are "active" (have a token)
        users = db.query(User).filter(User.api_token.isnot(None)).all()
        for user in users:
            process_user_full_sync(user, db)
    except Exception as e:
        logger.error(f"Sync Dashboard Job Failed: {e}")
    finally:
        db.close()

def get_client(user):
    cookies = None
    if user.moodle_cookies:
        try: cookies = json.loads(user.moodle_cookies)
        except: pass
    return MoodleClient("https://ys.learnus.org", cookies=cookies)

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

def process_user_full_sync(user: User, db: Session):
    try:
        client = get_client(user)
        # Attempt minimal login check
        client.session.get("https://ys.learnus.org/my/", timeout=10) # refresh session if needed
             
        active_courses = db.query(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()
        for c in active_courses:
             try:
                client.sync_course_to_db(c.moodle_id, db, user.id)
             except: pass
                 
    except Exception as e:
         logger.error(f"Full sync failed for {user.username}: {e}")

def send_push_notification(user: User, course: Course, post: Post):
    try:
        ai = AIService()
        # Summarize (Truncate content to 1000 chars to save AI tokens)
        summary = ai.generate_course_summary(course.name, [post], [], []) 
        # Actually generate_course_summary might be too broad. We generally want "Summarize this post".
        # But let's use what we have or a simple string.
        
        # Better:
        clean_content = (post.content or "")[:500]
        # summary = f"새로운 공지사항입니다." 
        # If we really want AI summary, we call OpenAI here.
        
        # Let's construct a message.
        msg_body = f"{post.title}"
        
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
        except Exception as exc:
            logger.error(f"Expo Send Error: {exc}")

        logger.info(f"Sent push to {user.username} for post {post.id}")
    except Exception as e:
        logger.error(f"Failed to send push: {e}")
