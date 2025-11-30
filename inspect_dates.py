from database import init_db, Assignment
from sqlalchemy.orm import Session

SessionLocal = init_db('learnus.db')
db = SessionLocal()

assignments = db.query(Assignment).all()
with open("dates.txt", "w", encoding="utf-8") as f:
    f.write(f"Found {len(assignments)} assignments.\n")
    for a in assignments:
        f.write(f"ID: {a.id}, Title: {a.title}, Due Date: '{a.due_date}', URL: {a.url}\n")

db.close()
