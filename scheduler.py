import logging
import time
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
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

def _load_cookies(raw: str) -> dict:
    """Parse moodle_cookies field — supports both legacy JSON dict and new raw cookie string."""
    if not raw:
        return {}
    if raw.startswith('{'):
        return json.loads(raw)
    cookies = {}
    for item in raw.split(';'):
        item = item.strip()
        if not item:
            continue
        if '=' in item:
            k, v = item.split('=', 1)
            cookies[k.strip()] = v.strip()
        else:
            cookies[item] = ''  # keyless token (e.g. device UUID)
    return cookies

# Helper to get client for user (SSO cookies-only auth)
def get_client(user: User):
    """
    Creates a MoodleClient using stored SSO cookies.
    This system relies on cookies obtained from WebView SSO login - no passwords are stored.
    """
    if not user.moodle_cookies:
        logger.warning(f"No cookies stored for user {user.username}")
        return None

    raw = user.moodle_cookies
    try:
        cookies = _load_cookies(raw)
    except Exception as e:
        logger.error(f"Failed to parse cookies for user {user.username}: {e}")
        return None

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
                        "type": "announcement",
                        "postId": post.id,
                        "postUrl": post.url,
                        "postTitle": post.title,
                        "courseId": course.id,
                        "courseName": course.name,
                        "saveToHistory": True
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

        notify_assignment_pref = prefs.get('new_assignment', True)
        notify_vod_pref = prefs.get('new_vod', True)
        notify_notice_pref = prefs.get('notice', True)

        courses = db.query(Course).filter(Course.owner_id == user.id, Course.is_active == True).all()

        for course in courses:
            # Per-course initialization: if this course has never been synced before,
            # insert all its content silently (no notifications) and mark it initialized.
            # This prevents historical data from firing notifications even if the user-level
            # flag was set prematurely (e.g. when other courses failed in a previous run).
            course_is_first = not course.is_initialized

            notify_assignment = notify_assignment_pref and not course_is_first
            notify_vod = notify_vod_pref and not course_is_first
            notify_notice = notify_notice_pref and not course_is_first

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
                            send_simple_push(user, f"[{course.name}] 새로운 과제 등장!", f"{item['name']}", "assignment", course.name)

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
                            send_simple_push(user, f"[{course.name}] {item['name']}", body, "vod", course.name)
                    else:
                        vod.is_completed = item['is_completed']

                db.commit()

                # --- Notices (Board) ---
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

                            if notify_notice:
                                send_push_notification(user, course, new_post)

                # Mark this course as initialized after its first successful sync
                if course_is_first:
                    course.is_initialized = True
                    db.commit()
                    logger.info(f"Course '{course.name}' initialized for {user.username}.")

            except Exception as e:
                logger.error(f"Error processing course {course.name} for user {user.username}: {e}")
                continue

        # Keep user-level flag in sync for backwards compatibility
        if not user.notifications_initialized:
            user.notifications_initialized = True
            db.commit()

    except Exception as e:
        logger.error(f"Error updating user {user.username}: {e}")
        pass

def send_simple_push(user: User, title: str, body: str, notif_type: str = "general", course_name: str = None):
    try:
         res = PushClient().publish(
            PushMessage(
                to=user.push_token,
                sound="default",
                title=title,
                body=body,
                data={
                    "type": notif_type,
                    "courseName": course_name,
                    "saveToHistory": True
                }
            )
         )
         logger.info(f"Sent simple push to {user.username}: {title}")
    except Exception as exc:
        logger.error(f"Simple Expo Send Error: {exc}")


_watch_running = set()  # track which user IDs are currently being watched

def watch_vods_for_user(user_id, SessionLocal, blocking=False):
    """Watch all available unwatched VODs for a single user. Safe to call from any thread.
    When blocking=True, waits for all VODs to finish before returning (used by worker jobs)."""
    if user_id in _watch_running:
        logger.info(f"Skipping user {user_id} — watch already in progress")
        return

    # Fetch user fresh in its own session to avoid detached instance issues
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user or not user.moodle_cookies:
            return

        client = get_client(user)
        if not client:
            return

        now = datetime.now()
        vods = db.query(VOD).join(Course).filter(
            Course.owner_id == user_id,
            Course.is_active == True,
            VOD.is_completed == False,
            VOD.has_tracking == True,
        ).all()

        available = []
        for v in vods:
            try:
                start = datetime.fromisoformat(v.start_date) if v.start_date else None
                end = datetime.fromisoformat(v.end_date) if v.end_date else None
                if end and end < now:
                    continue
                if start and start > now:
                    continue
                available.append(v)
            except Exception:
                available.append(v)

        cookies = _load_cookies(user.moodle_cookies or '')
        username = user.username
    finally:
        db.close()

    if not available:
        logger.info(f"No unwatched VODs for user {user_id}")
        return

    logger.info(f"Watching {len(available)} VODs for {username}")
    _watch_running.add(user_id)

    def watch_single_vod(vod_id, vod_db_id, vod_title, cookies, vod_duration=None, vod_url=None):
        # Each thread gets its own MoodleClient/session — requests.Session is not thread-safe
        c = MoodleClient("https://ys.learnus.org", cookies=cookies)
        success = c.watch_vod(vod_id, duration=vod_duration, viewer_url=vod_url)
        if success:
            inner_db = SessionLocal()
            try:
                db_vod = inner_db.query(VOD).filter_by(id=vod_db_id).first()
                if db_vod:
                    db_vod.is_completed = True
                    inner_db.commit()
                    logger.info(f"Marked VOD '{vod_title}' complete for user {user_id}")
            finally:
                inner_db.close()
        return success

    def watch_user_vods(user_id, vod_list, cookies):
        try:
            with ThreadPoolExecutor(max_workers=min(len(vod_list), 5)) as ex:
                futures = {
                    ex.submit(watch_single_vod, v.moodle_id, v.id, v.title, cookies, v.duration, v.url): v
                    for v in vod_list
                }
                for future in as_completed(futures):
                    vod = futures[future]
                    try:
                        future.result()
                    except Exception as e:
                        logger.error(f"VOD '{vod.title}' watch error: {e}")
        finally:
            _watch_running.discard(user_id)

    if blocking:
        watch_user_vods(user_id, available, cookies)
    else:
        t = ThreadPoolExecutor(max_workers=1)
        t.submit(watch_user_vods, user_id, available, cookies)
        t.shutdown(wait=False)

def watch_vods_job(SessionLocal):
    """Scheduler entry point — runs watch_vods_for_user for all users."""
    logger.info("Running VOD watch job...")
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.moodle_cookies.isnot(None)).all()
        for user in users:
            try:
                watch_vods_for_user(user.id, SessionLocal)
            except Exception as e:
                logger.error(f"watch_vods_job failed for {user.username}: {e}")
    finally:
        db.close()

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

def check_session_health_job(SessionLocal):
    """
    Runs every 30 minutes.
    Checks each user's Moodle session validity and sends a push notification
    if the session has expired (once, until they re-login).
    """
    logger.info("Running session health check...")
    db = SessionLocal()
    try:
        users = db.query(User).filter(
            User.moodle_cookies.isnot(None),
            User.push_token.isnot(None),
            User.session_expired_notified == False,
        ).all()
        for user in users:
            try:
                client = get_client(user)
                if client is not None:
                    continue  # Session is still valid
                logger.warning(f"Session expired for {user.username}, sending push notification")
                send_simple_push(
                    user,
                    "세션 만료",
                    "로그인 세션이 만료되었습니다. 앱을 열어 다시 로그인해주세요.",
                    notif_type="session_expired",
                )
                user.session_expired_notified = True
                db.commit()
            except Exception as e:
                logger.error(f"Session health check failed for {user.username}: {e}")
    except Exception as e:
        logger.error(f"Session Health Check Job Failed: {e}")
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
        users = db.query(User).all()
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
