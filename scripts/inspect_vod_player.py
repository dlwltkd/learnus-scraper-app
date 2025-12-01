from moodle_client import MoodleClient
import logging
import re

# Configure logging
logging.basicConfig(level=logging.INFO)

client = MoodleClient("https://ys.learnus.org", session_file='session.json')

# Use a known VOD ID from previous steps (e.g., from course 282673 or 279348)
# Let's try to find a VOD URL first.
course_id = 282673
print(f"Fetching contents for course {course_id}...")
contents = client.get_course_contents(course_id)

if contents['vods']:
    vod = contents['vods'][0]
    print(f"Found VOD ID: {vod['id']} ({vod['url']})")
    
    # Fetch the VOD page
    print("Fetching VOD page...")
    try:
        response = client.session.get(vod['url'])
        response.raise_for_status()
        
        with open("vod_player.html", "w", encoding="utf-8") as f:
            f.write(response.text)
            
        print("Saved VOD page to vod_player.html")
        
        # Try to find the actual player URL or tracking code
        # Often Moodle VODs redirect to a viewer or have an iframe
        if 'window.open' in response.text:
            print("Found window.open, looking for popup URL...")
            match = re.search(r"window\.open\('([^']+)'", response.text)
            if match:
                popup_url = match.group(1)
                print(f"Popup URL: {popup_url}")
                
                # Fetch popup
                res_popup = client.session.get(popup_url)
                with open("vod_popup.html", "w", encoding="utf-8") as f:
                    f.write(res_popup.text)
                print("Saved popup to vod_popup.html")

    except Exception as e:
        print(f"Error: {e}")
else:
    print("No VODs found in this course.")
