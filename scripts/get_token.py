import sys
import os
import requests
import json

def main():
    # Load credentials
    try:
        with open('credentials.json', 'r') as f:
            creds = json.load(f)
            username = creds.get('username')
            password = creds.get('password')
            service = creds.get('service', 'moodle_mobile_app')
    except Exception as e:
        print(f"Could not load credentials: {e}")
        return

    base_url = "https://ys.learnus.org"
    token_url = f"{base_url}/login/token.php"
    
    print(f"Requesting token for {username} (Service: {service})...")
    
    try:
        response = requests.post(token_url, data={
            'username': username,
            'password': password,
            'service': service
        })
        response.raise_for_status()
        
        data = response.json()
        if 'token' in data:
            token = data['token']
            print(f"SUCCESS! Token: {token}")
            
            # Save token to credentials.json (optional, or just use it)
            creds['token'] = token
            with open('credentials.json', 'w') as f:
                json.dump(creds, f, indent=4)
            print("Token saved to credentials.json")
            
        elif 'error' in data:
            print(f"Error: {data['error']} - {data.get('errorcode')}")
        else:
            print(f"Unknown response: {data}")
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    main()
