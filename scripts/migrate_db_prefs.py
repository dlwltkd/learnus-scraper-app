import os
import sys

# Add parent directory to path to allow importing 'database'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import init_db

# Initialize DB to get engine (uses env vars automatically)
SessionLocal = init_db()
# Create a dummy session to get the bind (engine)
session = SessionLocal()
engine = session.get_bind()
session.close()

def migrate():
    print(f"Migrating database... Dialect: {engine.dialect.name}")
    
    with engine.connect() as conn:
        try:
            if engine.dialect.name == 'postgresql':
                # Valid Postgres Check
                res = conn.execute(text("SELECT count(*) FROM information_schema.columns WHERE table_name='users' AND column_name='notification_preferences'"))
                if res.scalar() > 0:
                    print("Column 'notification_preferences' already exists (PG).")
                    return
                
                print("Adding column for PostgreSQL...")
                conn.execute(text("ALTER TABLE users ADD COLUMN notification_preferences JSON DEFAULT '{}'"))
            
            else:
                # SQLite Check
                # PRAGMA table_info returns tuples (cid, name, type, notnull, dflt_value, pk)
                res = conn.execute(text("PRAGMA table_info(users)"))
                columns = [row[1] for row in res.fetchall()]
                if 'notification_preferences' in columns:
                    print("Column 'notification_preferences' already exists (SQLite).")
                    return
                
                print("Adding column for SQLite...")
                conn.execute(text("ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{}'"))
            
            conn.commit()
            print("Migration successful.")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            # conn.rollback() # handled by context manager usually or auto-commit

if __name__ == "__main__":
    migrate()
