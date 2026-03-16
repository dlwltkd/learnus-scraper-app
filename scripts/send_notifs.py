import requests
import json

API_URL = "http://167.172.208.209:8000/debug/send-push"
TOKEN = "8238d1a8-4abd-44f3-ae03-71e318654935"
HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "X-API-Token": TOKEN,
}

notifications = [
    {
        "title": "📢 공업수학1",
        "body": "[성적 공지] 중간고사 성적이 게시되었습니다. 엑셀 파일을 확인해주세요. 전체 평균: 70.45점 / 최고점: 98점 / 최저점: 41점",
        "data": {"type": "announcement", "courseName": "공업수학1"},
    },
    {
        "title": "🎬 새 동영상 강의 오픈",
        "body": "'5주차 - 고유값과 고유벡터' 강의가 열렸습니다. (선형대수학)\n~ 3월 28일까지 시청 가능",
        "data": {"type": "vod", "courseName": "선형대수학"},
    },
    {
        "title": "⚠️ 과제 마감 1시간 전 (미제출)",
        "body": "'4주차 과제 - 정렬 알고리즘 구현' 과제가 곧 마감됩니다. (알고리즘)",
        "data": {"type": "assignment", "courseName": "알고리즘"},
    },
]

for notif in notifications:
    res = requests.post(
        API_URL,
        data=json.dumps(notif, ensure_ascii=False).encode("utf-8"),
        headers=HEADERS,
    )
    print(notif["title"], "→", res.json())
