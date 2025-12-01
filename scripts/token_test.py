import requests
import json
import sys

# Force UTF-8
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://ys.learnus.org"
TOKEN = "nda2mzgzntc4odyymdm2ymqxnde1yzuxogexmja3njg6ojo2yzqzntdknzbizgyyy2e1ndk5yzjimwy4n2y1ogfmnto6olq0t3njvwdqqtnmeuwyq0joaezqceyzmna2yxzjdvztm2zlsznhagvqs0nyrnbesdzom1fsbwzmblhgqndsv0q="

def test_token():
    print(f"Testing token: {TOKEN[:20]}...")
    
    endpoint = f"{BASE_URL}/webservice/rest/server.php"
    params = {
        'wstoken': TOKEN,
        'wsfunction': 'core_webservice_get_site_info',
        'moodlewsrestformat': 'json'
    }
    
    try:
        response = requests.post(endpoint, data=params)
        print(f"Status Code: {response.status_code}")
        
        try:
            data = response.json()
            print("Response JSON:")
            print(json.dumps(data, indent=2, ensure_ascii=True))
        except json.JSONDecodeError:
            print("Response is not JSON.")
            print(response.text[:500])
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_token()
