from moodle_client import MoodleClient
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

client = MoodleClient("https://ys.learnus.org", session_file='session.json')
course_id = 282673

print(f"Fetching contents for course {course_id}...")
try:
    contents = client.get_course_contents(course_id)
    with open("vod_status.txt", "w", encoding="utf-8") as f:
        f.write(f"Found {len(contents['vods'])} VODs.\n")
        
        completed_count = 0
        uncompleted_count = 0
        
        for vod in contents['vods']:
            status = "Completed" if vod['is_completed'] else "Uncompleted"
            if vod['is_completed']:
                completed_count += 1
            else:
                uncompleted_count += 1
                f.write(f"Uncompleted VOD: {vod['name']} (ID: {vod['id']})\n")
                
        f.write(f"\nSummary: {completed_count} Completed, {uncompleted_count} Uncompleted\n")
        
    print("Saved to vod_status.txt")
    
except Exception as e:
    print(f"Error: {e}")
