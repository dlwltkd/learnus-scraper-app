from database import init_db, Assignment

SessionLocal = init_db()
db = SessionLocal()
course_id = 277509

print(f"Checking assignments for course {course_id} in DB...")
assignments = db.query(Assignment).filter_by(course_id=course_id).all()
with open("db_assignments.txt", "w", encoding="utf-8") as f:
    for a in assignments:
        f.write(f"ID: {a.id}, Title: {a.title}, Due Date: '{a.due_date}'\n")

print("Saved to db_assignments.txt")

db.close()
