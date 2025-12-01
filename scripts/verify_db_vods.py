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

from database import Base, VOD, Course
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
    
    course_id = 277509
    print(f"Verifying VODs for course {course_id} in DB...")
    
    try:
        vods = db.query(VOD).filter(VOD.course_id == course_id).all()
        print(f"Found {len(vods)} VODs in DB.")
        
        for v in vods:
            print(f"ID: {v.id}, Title: {v.title}")
            print(f"  Is Completed: {v.is_completed}")
            print(f"  Start Date: {v.start_date}")
            print(f"  End Date: {v.end_date}")
            print("-" * 20)
            
    except Exception as e:
        logger.error(f"Error verifying DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
