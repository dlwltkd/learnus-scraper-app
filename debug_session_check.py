from moodle_client import MoodleClient
import sys

# Encoding fix
sys.stdout.reconfigure(encoding='utf-8')

def debug_session_check():
    client = MoodleClient("https://ys.learnus.org", session_file='session.json')
    print("Checking session validity with new cookies...")
    print(f"Session Headers: {client.session.headers}")
    print(f"Session Cookies: {client.session.cookies.get_dict()}")
    
    try:
        # Try fetching the main page
        response = client.session.get("https://ys.learnus.org/")
        print(f"Main page status: {response.status_code}")
        print(f"Final URL: {response.url}")
        print(f"Redirect History: {response.history}")
        
        # Check for login redirect
        if "login/index.php" in response.url or \
           '<form action="https://ys.learnus.org/login/index.php"' in response.text or \
           "Log in to the site" in response.text or \
           "coursemosLoginHook.php" in response.text or \
           "notloggedin" in response.text:
            print("Session INVALID: Redirected to login or not logged in.")
        else:
            print("Session VALID.")
            # Try to find a course to scrape to be sure
            courses = client.get_courses()
            print(f"Found {len(courses)} courses.")
            if courses:
                first_course = courses[0]
                print(f"Attempting to fetch contents for course: {first_course['fullname']} (ID: {first_course['id']})")
                contents = client.get_course_contents(first_course['id'])
                print("Successfully fetched course contents.")
                print(f"Found {len(contents['assignments'])} assignments and {len(contents['vods'])} VODs.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_session_check()
