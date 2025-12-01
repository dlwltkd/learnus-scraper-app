import sys
import os
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_service import AIService
from datetime import datetime

# Mock data
class MockItem:
    def __init__(self, title, content=None, date=None, due_date=None, is_completed=False, start_date=None, end_date=None):
        self.title = title
        self.content = content
        self.created_at = date
        self.due_date = due_date
        self.is_completed = is_completed
        self.start_date = start_date
        self.end_date = end_date

def test_ai_summary():
    print("Testing AI Service...")
    service = AIService()
    
    course_name = "Introduction to Computer Science"
    
    announcements = [
        MockItem("Midterm Exam Announcement", "The midterm exam will cover chapters 1-5. It is related to Assignment 3.", date="2025-10-01")
    ]
    
    assignments = [
        MockItem("Assignment 3: Data Structures", due_date="2025-10-10", is_completed=False),
        MockItem("Assignment 2: Loops", due_date="2025-09-20", is_completed=True)
    ]
    
    vods = [
        MockItem("Lecture 5: Trees", start_date="2025-10-01", end_date="2025-12-31", is_completed=False)
    ]
    
    try:
        summary = service.generate_course_summary(course_name, announcements, assignments, vods)
        print("\nGenerated Summary:\n")
        print(summary)
        print("\nTest Passed!")
    except Exception as e:
        print(f"\nTest Failed: {e}")

if __name__ == "__main__":
    test_ai_summary()
