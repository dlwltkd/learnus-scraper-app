import logging
import time
import json
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from database import init_db, User, Course, Board, Post, Assignment, VOD
from moodle_client import MoodleClient
from ai_service import AIService

from exponent_server_sdk import PushClient, PushMessage

SessionLocal = init_db()

# Setup Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Watcher")

# Helper to get client for user (SSO cookies-only auth)
def get_client(user: User):
    """
    Creates a MoodleClient using stored SSO cookies.
    This system relies on cookies obtained from WebView SSO login - no passwords are stored.
    """
    if not user.moodle_cookies:
        logger.warning(f"No cookies stored for user {user.username}")
        return None

    # Parse cookies from JSON string
    try:
        cookies = json.loads(user.moodle_cookies)
    except (json.JSONDecodeError, TypeError) as e:
        logger.error(f"Failed to parse cookies for user {user.username}: {e}")
        return None

    # Create client with base_url and cookies
    client = MoodleClient("https://ys.learnus.org", cookies=cookies)

    # Validate session is still active
    if not client.is_session_valid():
        logger.warning(f"Session expired for user {user.username}")
        return None

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


def process_user_updates(user: User, db: Session):
    try:
        client = get_client(user)
        if not client:
            return  # No valid session - skip this user

        # Load Prefs
        prefs = user.notification_preferences or {}
        if isinstance(prefs, str):
            try: prefs = json.loads(prefs)
            except: prefs = {}

        # Default True if not set
        notify_assignment = prefs.get('new_assignment', True)
        notify_vod = prefs.get('new_vod', True)
        notify_notice = prefs.get('notice', True)

        courses = db.query(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()

        for course in courses:
            try:
                # 1. Fetch ALL content for the course (Assignments, VODs, Boards logic)
                contents = client.get_course_contents(course.moodle_id)

                # --- Assignments ---
                for item in contents.get('assignments', []):
                    assign = db.query(Assignment).filter(
                        Assignment.moodle_id == item['id'],
                        Assignment.course_id == course.id
                    ).first()

                    if not assign:
                        # NEW Assignment
                        new_assign = Assignment(
                            moodle_id=item['id'],
                            course_id=course.id,
                            title=item['name'],
                            url=item['url'],
                            is_completed=item['is_completed'],
                            due_date=item.get('deadline_text')
                        )
                        # Deep fetch deadline if needed
                        if not new_assign.due_date and '/mod/assign/' in item['url']:
                            new_assign.due_date = client.get_assignment_deadline(item['url'])

                        db.add(new_assign)
                        db.commit()

                        if notify_assignment:
                            send_simple_push(user, f"[{course.name}] 새로운 과제 등장!", f"{item['name']}")

                    else:
                        # Update existing
                        assign.is_completed = item['is_completed']
                        if item.get('deadline_text'): assign.due_date = item.get('deadline_text')

                # --- VODs ---
                for item in contents.get('vods', []):
                    vod = db.query(VOD).filter(VOD.moodle_id == item['id'], VOD.course_id == course.id).first()
                    if not vod:
                        # NEW VOD
                        new_vod = VOD(
                            moodle_id=item['id'],
                            course_id=course.id,
                            title=item['name'],
                            url=item['url'],
                            is_completed=item['is_completed'],
                            has_tracking=item['has_tracking'],
                            start_date=item.get('start_date'),
                            end_date=item.get('end_date')
                        )
                        db.add(new_vod)
                        db.commit()

                        if notify_vod:
                            body = f"새로운 동영상 강의\n시청 기한: {item.get('start_date', '?')} ~ {item.get('end_date', '?')}"
                            send_simple_push(user, f"[{course.name}] {item['name']}", body)
                    else:
                        vod.is_completed = item['is_completed']

                db.commit()

                # --- Notices (Board) ---
                if notify_notice:
                     notice_board_info = next((b for b in contents.get('boards', []) if '공지' in b['name'] or 'Notice' in b['name']), None)
                     if notice_board_info:
                         board = db.query(Board).filter(Board.moodle_id == notice_board_info['id'], Board.course_id == course.id).first()
                         if not board:
                             board = Board(moodle_id=notice_board_info['id'], course_id=course.id, title=notice_board_info['name'], url=notice_board_info['url'])
                             db.add(board)
                             db.commit()

                         posts_data = client.get_board_posts(board.moodle_id)
                         for p_data in posts_data:
                             exists = db.query(Post).filter(
                                 Post.board_id == board.id,
                                 Post.title == p_data['subject'],
                                 Post.date == p_data['date']
                             ).first()

                             if not exists:
                                 new_post = Post(
                                     board_id=board.id,
                                     title=p_data['subject'],
                                     writer=p_data['writer'],
                                     date=p_data['date'],
                                     url=p_data['url']
                                 )
                                 new_post.content = client.get_post_content(p_data['url'])
                                 db.add(new_post)
                                 db.commit()

                                 send_push_notification(user, course, new_post)

            except Exception as e:
                logger.error(f"Error processing course {course.name} for user {user.username}: {e}")
                continue

    except Exception as e:
        logger.error(f"Error updating user {user.username}: {e}")
        pass

def send_simple_push(user: User, title: str, body: str):
    try:
         res = PushClient().publish(
            PushMessage(
                to=user.push_token,
                sound="default",
                title=title,
                body=body,
                data={"type": "info"}
            )
         )
         logger.info(f"Sent simple push to {user.username}: {title}")
    except Exception as exc:
        logger.error(f"Simple Expo Send Error: {exc}")


def check_notices_job(SessionLocal):
    """
    Runs every 5 minutes.
    Checks for NEW posts in 'Notices' boards for all active users.
    """
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.push_token.isnot(None)).all()
        for user in users:
            process_user_updates(user, db)
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
        users = db.query(User).filter(User.is_active == True).all()
        for user in users:
            try:
                client = get_client(user)
                if not client:
                    continue

                courses = db.query(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()
                for course in courses:
                    try:
                        client.sync_course_to_db(course.moodle_id, db, user.id)
                        logger.info(f"Synced course {course.name} for user {user.username}")
                    except Exception as e:
                        logger.error(f"Failed to sync course {course.name}: {e}")
            except Exception as e:
                logger.error(f"Error processing user {user.username}: {e}")
    finally:
        db.close()
