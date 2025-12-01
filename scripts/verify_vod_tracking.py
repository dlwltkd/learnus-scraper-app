from moodle_client import MoodleClient
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

client = MoodleClient("https://ys.learnus.org", session_file='session.json')
course_id = 279348

print(f"Fetching contents for course {course_id}...")
try:
    contents = client.get_course_contents(course_id)
    print(f"Found {len(contents['vods'])} VODs.")
    
    untracked_count = 0
    tracked_count = 0
    
    with open("vod_tracking_status.txt", "w", encoding="utf-8") as f:
        for vod in contents['vods']:
            if not vod.get('has_tracking', True):
                untracked_count += 1
                f.write(f"Untracked VOD: {vod['name']} (ID: {vod['id']})\n")
            else:
                tracked_count += 1
                f.write(f"Tracked VOD: {vod['name']} (ID: {vod['id']})\n")
                
        f.write(f"\nSummary: {untracked_count} Untracked, {tracked_count} Tracked\n")
        
    print(f"Summary: {untracked_count} Untracked, {tracked_count} Tracked")
    print("Saved to vod_tracking_status.txt")
    
except Exception as e:
    print(f"Error: {e}")
