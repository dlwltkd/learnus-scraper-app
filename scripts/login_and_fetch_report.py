import json
from moodle_client import MoodleClient

def login_and_fetch():
    # Load credentials
    with open('credentials.json', 'r') as f:
        creds = json.load(f)
    
    username = creds['username']
    password = creds['password']
    
    client = MoodleClient("https://ys.learnus.org", session_file='session.json')
    
    print(f"Logging in as {username}...")
    try:
        client.login(username, password)
        client.save_session('session.json')
        print("Login successful and session saved.")
        
        # Fetch report
        url = "https://ys.learnus.org/report/ubcompletion/user_progress_a.php?id=277509"
        print(f"Fetching {url}...")
        response = client.session.get(url)
        response.raise_for_status()
        
        if "login/index.php" in response.url:
            print("Error: Still redirected to login page.")
        else:
            filename = "report_277509.html"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(response.text)
            print(f"Saved report to {filename}")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    login_and_fetch()
