from moodle_client import MoodleClient

client = MoodleClient("https://ys.learnus.org", session_file='session.json')
url = "https://ys.learnus.org/mod/assign/view.php?id=3741890"

print(f"Fetching {url}...")
try:
    response = client.session.get(url)
    response.raise_for_status()
    with open("assignment.html", "w", encoding="utf-8") as f:
        f.write(response.text)
    print("Saved to assignment.html")
except Exception as e:
    print(f"Error: {e}")
