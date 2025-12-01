import requests

url = "https://ys.learnus.org/lib/requirejs.php/1759221356/mod_vod/vod.js"
print(f"Fetching {url}...")
try:
    response = requests.get(url)
    if response.status_code == 200:
        with open("mod_vod.js", "w", encoding="utf-8") as f:
            f.write(response.text)
        print("Saved mod_vod.js")
    else:
        print(f"Failed to fetch: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
