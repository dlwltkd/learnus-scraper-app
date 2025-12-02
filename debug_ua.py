import requests
import sys

# Encoding fix
sys.stdout.reconfigure(encoding='utf-8')

def debug_ua_check():
    url = "https://ys.learnus.org/"
    
    # Cookies provided by user
    cookies = {
        "MoodleSession": "bp8refrlemujp04f1uau65cdvn",
        "_ga": "GA1.1.1084463101.1764612590",
        "LEARNUS_HAVE_SSOLOGINED": "Y",
        "_ga_RKV53EG2JP": "GS2.1.s1764612589$o1$g0$t1764612589$j60$l0$h0",
        "_ga_KE6G3ZX5LV": "GS2.1.s1764612589$o1$g0$t1764612589$j60$l0$h0"
    }
    
    # 1. Test with default Python User-Agent
    print("--- Test 1: Default Python User-Agent ---")
    try:
        res = requests.get(url, cookies=cookies, allow_redirects=False)
        print(f"Status: {res.status_code}")
        
        is_login = False
        if res.status_code == 303 or "login/index.php" in res.headers.get('Location', ''):
             is_login = True
        elif res.status_code == 200:
             if "login/index.php" in res.url or "Log in" in res.text or "coursemosLoginHook.php" in res.text or "notloggedin" in res.text:
                 is_login = True
        
        if is_login:
             print("Result: REDIRECT/LOGIN (Failed)")
        else:
             print("Result: SUCCESS (Main page)")
             
    except Exception as e:
        print(f"Error: {e}")

    # 2. Test with Browser User-Agent
    print("\n--- Test 2: Browser User-Agent ---")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        res = requests.get(url, cookies=cookies, headers=headers, allow_redirects=False)
        print(f"Status: {res.status_code}")
        
        is_login = False
        if res.status_code == 303 or "login/index.php" in res.headers.get('Location', ''):
             is_login = True
        elif res.status_code == 200:
             if "login/index.php" in res.url or "Log in" in res.text or "coursemosLoginHook.php" in res.text or "notloggedin" in res.text:
                 is_login = True
        
        if is_login:
             print("Result: REDIRECT/LOGIN (Failed)")
        else:
             print("Result: SUCCESS (Main page)")
             
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_ua_check()
