import os
import sys
import io
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set stdout to utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add parent dir to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, Assignment, Course
from moodle_client import MoodleClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    # Setup DB connection
    DATABASE_URL = "sqlite:///./learnus.db"
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    base_url = "https://ys.learnus.org"
    session_file = os.path.abspath("session.json")
    
    client = MoodleClient(base_url, session_file=session_file)
    
    if not client.sesskey:
        logger.error("Failed to load session. Please login via the app first.")
        return

    course_id = 277509
    print(f"Syncing course {course_id} to DB...")
    
    try:
        client.sync_course_to_db(course_id, db)
        print("Sync complete.")
        
        # Verify DB content
        print("Verifying DB content...")
        assignments = db.query(Assignment).filter(Assignment.course_id == course_id).all()
        
        found_target = False
        for assign in assignments:
            print(f"ID: {assign.id}, Title: {assign.title}")
            print(f"  Due Date: {assign.due_date}")
            print(f"  Is Completed: {assign.is_completed}")
            
            if assign.id == 4160018:
                found_target = True
                if assign.due_date == "2025-09-20 23:59":
                    print("  [SUCCESS] Target quiz deadline matches in DB!")
                else:
                    print(f"  [FAILURE] Target quiz deadline mismatch in DB. Expected '2025-09-20 23:59', got '{assign.due_date}'")
                
                if assign.is_completed:
                    print("  [SUCCESS] Target quiz is completed in DB!")
                else:
                    print("  [FAILURE] Target quiz is NOT completed in DB!")
                    
        if not found_target:
            print("[FAILURE] Target quiz (ID 4160018) not found in DB.")
            
    except Exception as e:
        logger.error(f"Error during sync/verification: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
