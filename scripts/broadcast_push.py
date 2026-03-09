import sys
sys.path.append('.')

from database import init_db, User
from exponent_server_sdk import PushClient, PushMessage

SessionLocal = init_db()
db = SessionLocal()

try:
    users = db.query(User).filter(User.push_token != None).all()
    print(f"Sending to {len(users)} users...")
    for user in users:
        try:
            PushClient().publish(
                PushMessage(
                    to=user.push_token,
                    sound="default",
                    title="업데이트 안내",
                    body="LearnUs Connect 최신 버전이 출시되었습니다. 앱을 업데이트해 주세요!",
                    data={"type": "general", "saveToHistory": True}
                )
            )
            print(f"  Sent to {user.username}")
        except Exception as e:
            print(f"  Failed for {user.username}: {e}")
    print("Done.")
finally:
    db.close()
