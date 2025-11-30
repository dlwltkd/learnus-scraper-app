import sqlite3

def migrate_db():
    conn = sqlite3.connect('learnus.db')
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(courses)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'is_active' not in columns:
            print("Adding is_active column to courses table...")
            cursor.execute("ALTER TABLE courses ADD COLUMN is_active BOOLEAN DEFAULT 1")
            conn.commit()
            print("Migration successful.")
        else:
            print("Column is_active already exists.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_db()
