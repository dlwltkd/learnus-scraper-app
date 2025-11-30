import requests
import json
import sys

# Force UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def test_session():
    try:
        with open('session.json', 'r') as f:
            session_info = json.load(f)
    except FileNotFoundError:
        print("session.json not found")
        return

    sesskey = session_info['sesskey']
    cookies = session_info['cookies']
    base_url = session_info['wwwroot']

    # Fetch a specific post
    # https://ys.learnus.org/mod/ubboard/article.php?id=4123947&bwid=2044979
    post_url = f"{base_url}/mod/ubboard/article.php?id=4123947&bwid=2044979"
    output_file = "post_2044979.html"
    
    print(f"Fetching {post_url}...")
    try:
        response = requests.get(post_url, cookies=cookies)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            html = response.text
            print(f"HTML Length: {len(html)}")
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"Saved to {output_file}")
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_session()
