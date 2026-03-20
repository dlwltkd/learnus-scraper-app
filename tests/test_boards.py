from database import Course, Board, Post


def test_get_boards_for_course(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    b = Board(moodle_id=10, course_id=course.id, title="Announcements", url="http://example.com/b")
    db.add(b)
    db.commit()

    resp = client.get(f"/courses/{course.id}/boards", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Announcements"
    assert data[0]["id"] == 10  # moodle_id


def test_get_boards_empty(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    resp = client.get(f"/courses/{course.id}/boards", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_posts_for_board(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    board = Board(moodle_id=10, course_id=course.id, title="Announcements", url="http://example.com/b")
    db.add(board)
    db.commit()
    db.refresh(board)

    p = Post(
        board_id=board.id, title="Welcome", writer="Prof Kim",
        date="2025-03-01", content="Hello students!", url="http://example.com/p1",
    )
    db.add(p)
    db.commit()

    resp = client.get(f"/boards/10/posts", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Welcome"
    assert data[0]["writer"] == "Prof Kim"


def test_get_post_detail(client, test_user, auth_headers, db):
    course = Course(moodle_id=100, owner_id=test_user.id, name="Test", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    board = Board(moodle_id=10, course_id=course.id, title="Board", url="http://example.com/b")
    db.add(board)
    db.commit()
    db.refresh(board)

    post = Post(
        board_id=board.id, title="Post Title", writer="Prof Lee",
        date="2025-03-15", content="<p>Detailed content here.</p>",
        url="http://example.com/p",
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    resp = client.get(f"/posts/{post.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Post Title"
    assert data["content"] == "<p>Detailed content here.</p>"


def test_get_post_not_found(client, test_user, auth_headers):
    resp = client.get("/posts/99999", headers=auth_headers)
    assert resp.status_code == 404


def test_board_access_denied_other_user(client, test_user, auth_headers, db):
    """Posts from boards belonging to another user's course should be denied."""
    from database import User

    other = User(username="other", api_token="other-token")
    db.add(other)
    db.commit()
    db.refresh(other)

    course = Course(moodle_id=999, owner_id=other.id, name="Other", is_active=True)
    db.add(course)
    db.commit()
    db.refresh(course)

    board = Board(moodle_id=50, course_id=course.id, title="Secret", url="http://example.com/b")
    db.add(board)
    db.commit()
    db.refresh(board)

    post = Post(board_id=board.id, title="Secret Post", writer="X", date="2025-01-01", url="http://example.com/p", content="hidden")
    db.add(post)
    db.commit()

    resp = client.get(f"/boards/50/posts", headers=auth_headers)
    assert resp.status_code == 403
