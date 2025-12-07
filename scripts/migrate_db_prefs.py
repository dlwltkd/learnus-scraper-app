import os
from sqlalchemy import text
from database import engine

def migrate():
    print(f"Migrating database... Dialect: {engine.dialect.name}")
    
    with engine.connect() as conn:
        try:
            # Check if column exists (naive check or just try/except)
            # Better: Try to select the column.
            try:
                conn.execute(text("SELECT notification_preferences FROM users LIMIT 1"))
                print("Column 'notification_preferences' already exists.")
                return
            except Exception:
                # Column likely doesn't exist
                pass

            # Proceed to Add
            if engine.dialect.name == 'postgresql':
                print("Adding column for PostgreSQL...")
                # Use JSON type (or JSONB)
                conn.execute(text("ALTER TABLE users ADD COLUMN notification_preferences JSON DEFAULT '{}'"))
            else:
                print("Adding column for SQLite...")
                # SQLite usually maps JSON to TEXT
                conn.execute(text("ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{}'"))
            
            conn.commit()
            print("Migration successful.")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            # conn.rollback() # handled by context manager usually or auto-commit

if __name__ == "__main__":
    migrate()
