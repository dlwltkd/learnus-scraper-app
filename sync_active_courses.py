"""
One-off script to backfill is_active for all existing users.
Runs scrape_active_courses() for each user and updates their courses accordingly.

Run on droplet:
    docker exec -it learnus_api python sync_active_courses.py
"""
import json
import logging
from database import init_db, User, Course
from moodle_client import MoodleClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

def run():
    SessionLocal = init_db()
    db = SessionLocal()

    try:
        users = db.query(User).all()
        logger.info(f"Found {len(users)} users.")

        for user in users:
            logger.info(f"--- Processing user: {user.username} (ID: {user.id}) ---")

            # Build Moodle client from stored cookies
            cookies = None
            if user.moodle_cookies:
                raw = user.moodle_cookies
                try:
                    if raw.startswith('{'):
                        cookies = json.loads(raw)
                    else:
                        cookies = {}
                        for item in raw.split(';'):
                            item = item.strip()
                            if not item:
                                continue
                            if '=' in item:
                                k, v = item.split('=', 1)
                                cookies[k.strip()] = v.strip()
                            else:
                                cookies[item] = ''
                except Exception:
                    pass

            if not cookies:
                logger.warning(f"  No cookies for {user.username}, skipping.")
                continue

            client = MoodleClient("https://ys.learnus.org", cookies=cookies)

            # Scrape active course IDs from the ubion page
            active_ids = client.scrape_active_courses()
            logger.info(f"  Active course IDs from ubion page: {active_ids}")

            if not active_ids:
                logger.warning(f"  scrape_active_courses() returned empty — skipping user to avoid wiping all courses.")
                continue

            # Update is_active for all courses belonging to this user
            courses = db.query(Course).filter(Course.owner_id == user.id).all()
            updated = 0
            for course in courses:
                new_active = course.moodle_id in active_ids
                if course.is_active != new_active:
                    logger.info(f"  {course.name}: is_active {course.is_active} -> {new_active}")
                    course.is_active = new_active
                    updated += 1

            db.commit()
            logger.info(f"  Updated {updated}/{len(courses)} courses for {user.username}.")

    except Exception as e:
        logger.error(f"Script failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run()
