import requests

url = "https://s3.ap-northeast-2.amazonaws.com/code.coursemos.co.kr/lc/learningChecker-v2-amd.js"
print(f"Fetching {url}...")
try:
    response = requests.get(url)
    if response.status_code == 200:
        with open("learningChecker.js", "w", encoding="utf-8") as f:
            f.write(response.text)
        print("Saved learningChecker.js")
    else:
        print(f"Failed to fetch: {response.status_code}")
        # Try without .js extension or with different path if needed
        # The require path was .../learningChecker-v2-amd
except Exception as e:
    print(f"Error: {e}")
