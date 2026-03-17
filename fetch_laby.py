import requests
from datetime import datetime

ver = f"?ver={int(datetime.now().timestamp() * 1000)}"
base = "https://alrs.yonsei.ac.kr/lab241player_180124/lab-script"

files = [
    f"lab.MainApp.js{ver}",
    f"lab.DtoStatscontentsinfoService.js{ver}",
    f"lab.BizVideoPlayer.js{ver}",
]

for filename in files:
    url = f"{base}/{filename}"
    print(f"Fetching: {url}")
    try:
        r = requests.get(url, timeout=15)
        print(f"  Status: {r.status_code}, Size: {len(r.text)} chars")
        savename = filename.split('?')[0]
        with open(f"/app/laby_js_{savename}", "w", encoding="utf-8") as f:
            f.write(r.text)
        print(f"  Saved: laby_js_{savename}")
    except Exception as e:
        print(f"  Failed: {e}")
