from moodle_client import MoodleClient
import json

def inspect_report():
    client = MoodleClient("https://ys.learnus.org", session_file='session.json')
    
    # URL provided by user
    url = "https://ys.learnus.org/report/ubcompletion/user_progress_a.php?id=277509"
    
    print(f"Fetching {url}...")
    try:
        response = client.session.get(url)
        response.raise_for_status()
        
        # Check if redirected to login
        if "login/index.php" in response.url:
            print("Error: Redirected to login page. Session expired.")
            return

        filename = "report_277509.html"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(response.text)
        print(f"Saved report to {filename}")
        
    except Exception as e:
        print(f"Failed to fetch report: {e}")

if __name__ == "__main__":
    inspect_report()
