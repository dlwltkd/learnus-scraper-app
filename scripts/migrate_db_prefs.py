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
            # Helper to check column existence
            def col_exists(table, col):
                if engine.dialect.name == 'postgresql':
                    res = conn.execute(text(f"SELECT count(*) FROM information_schema.columns WHERE table_name='{table}' AND column_name='{col}'"))
                    return res.scalar() > 0
                else:
                    res = conn.execute(text(f"PRAGMA table_info({table})"))
                    return col in [row[1] for row in res.fetchall()]

            # 1. Check/Add push_token
            if not col_exists('users', 'push_token'):
                print("Adding 'push_token' column...")
                if engine.dialect.name == 'postgresql':
                    conn.execute(text("ALTER TABLE users ADD COLUMN push_token TEXT"))
                else:
                    conn.execute(text("ALTER TABLE users ADD COLUMN push_token TEXT"))
            else:
                print("Column 'push_token' already exists.")

            # 2. Check/Add notification_preferences
            if not col_exists('users', 'notification_preferences'):
                print("Adding 'notification_preferences' column...")
                if engine.dialect.name == 'postgresql':
                    conn.execute(text("ALTER TABLE users ADD COLUMN notification_preferences JSON DEFAULT '{}'"))
                else:
                    conn.execute(text("ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{}'"))
            else:
                print("Column 'notification_preferences' already exists.")
            
            conn.commit()
            print("Migration successful.")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            # conn.rollback() # handled by context manager usually or auto-commit

if __name__ == "__main__":
    migrate()
