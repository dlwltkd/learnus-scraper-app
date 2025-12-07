import sqlite3
import os

# Path to your database
DB_PATH = 'learnus.db'

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'notification_preferences' in columns:
            print("Column 'notification_preferences' already exists.")
        else:
            print("Adding 'notification_preferences' column...")
            # SQLite doesn't have native JSON type in strict sense, usually stored as TEXT or JSON affinity
            cursor.execute("ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{}'")
            print("Defined as TEXT (for JSON storage)")
            conn.commit()
            print("Migration successful.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
