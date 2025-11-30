from fastapi.testclient import TestClient
from api import app
from database import init_db, Course
import sys

# Force UTF-8
sys.stdout.reconfigure(encoding='utf-8')

client = TestClient(app)

def test_api():
    print("Testing API...")
    
    # 1. Test Get Courses
    response = client.get("/courses")
    print(f"GET /courses: {response.status_code}")
    print(response.json())
    
    # 2. Test Sync (Course 276615)
    # Note: This might take a while as it scrapes
    print("\nSyncing Course 276615...")
    response = client.post("/sync/276615")
    print(f"POST /sync/276615: {response.status_code}")
    print(response.json())
    
    # 3. Test Get Assignments
    print("\nFetching Assignments...")
    response = client.get("/courses/276615/assignments")
    print(f"GET /courses/276615/assignments: {response.status_code}")
    assignments = response.json()
    print(f"Found {len(assignments)} assignments")
    if assignments:
        print(f"Sample: {assignments[0]['title']}")

    # 4. Test Get Boards
    print("\nFetching Boards...")
    response = client.get("/courses/276615/boards")
    print(f"GET /courses/276615/boards: {response.status_code}")
    boards = response.json()
    print(f"Found {len(boards)} boards")
    
    if boards:
        board_id = boards[0]['id']
        print(f"\nFetching Posts for Board {board_id}...")
        response = client.get(f"/boards/{board_id}/posts")
        print(f"GET /boards/{board_id}/posts: {response.status_code}")
        posts = response.json()
        print(f"Found {len(posts)} posts")
        if posts:
            print(f"Sample Post: {posts[0]['title']}")

if __name__ == "__main__":
    test_api()
