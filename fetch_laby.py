import requests

url = "https://alrs.yonsei.ac.kr/lab241player_180124/lab-script/lab.AppImport.js"
print(f"Fetching: {url}")
r = requests.get(url, timeout=15)
print(f"Status: {r.status_code}, Size: {len(r.text)} chars")

with open("/app/laby_js_AppImport.js", "w", encoding="utf-8") as f:
    f.write(r.text)
print("Saved to /app/laby_js_AppImport.js")
