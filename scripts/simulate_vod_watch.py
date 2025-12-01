
import requests
import re
import json
import time
import logging
import ast
from moodle_client import MoodleClient

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def parse_progress_args(html):
    """
    Extracts arguments from the amd.progress(...) call in the HTML.
    """
    # Look for amd.progress(...)
    match = re.search(r'amd\.progress\((.*?)\);', html, re.DOTALL)
    if not match:
        return None
    
    args_str = match.group(1)
    
    # Convert JS literals to Python literals
    args_str = args_str.replace('true', 'True').replace('false', 'False')
    
    # Wrap in brackets to parse as a list
    try:
        args = ast.literal_eval(f"[{args_str}]")
        return args
    except Exception as e:
        logger.error(f"Failed to parse arguments: {e}")
        return None

def watch_vod(client, vod_id):
    """
    Simulates watching a VOD.
    """
    viewer_url = f"{client.base_url}/mod/vod/viewer.php?id={vod_id}"
    logger.info(f"Fetching VOD viewer: {viewer_url}")
    
    try:
        response = client.session.get(viewer_url)
        response.raise_for_status()
        html = response.text
        
        args = parse_progress_args(html)
        if not args:
            logger.error("Could not find amd.progress call. Is this a valid VOD or are you logged in?")
            return False
            
        # Map arguments based on mod_vod.js analysis
        # function(d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C)
        # Indices:
        # 0: vodTagID (d)
        # 1: isProgress (e)
        # 5: isProgressPeriodCheck (i)
        # 6: courseid (j)
        # 7: cmid (k)
        # 8: trackid (l)
        # 9: attempt (m)
        # 10: duration? (n) - Let's assume this is duration or max time
        # 12: intervalSecond (p)
        # 17: beforeProgress (u)
        # 22: logtime (z)
        
        vodTagID = args[0]
        isProgress = args[1]
        isProgressPeriodCheck = args[5]
        courseid = args[6]
        cmid = args[7]
        trackid = args[8]
        attempt = args[9]
        duration = int(args[10]) # n seems to be total duration
        interval = args[12]
        beforeProgress = args[17]
        logtime = args[22]
        
        logger.info(f"VOD Info: ID={vodTagID}, Course={courseid}, CMID={cmid}, TrackID={trackid}, Duration={duration}, Interval={interval}")
        
        if not isProgress:
            logger.warning("Progress tracking is disabled for this VOD.")
            return False
            
        action_url = f"{client.base_url}/mod/vod/action.php"
        
        # 1. Initial Track (c.trackForWindow(3, 0))
        logger.info("Sending initial track request...")
        payload_init = {
            'type': 'vod_track_for_onwindow',
            'track': trackid,
            'state': 3, # Start
            'position': 0,
            'attempts': attempt,
            'interval': interval
        }
        client.session.post(action_url, data=payload_init)
        
        # 2. Initial Log (c.ajax("1", 0, 0))
        logger.info("Sending initial log request...")
        payload_log_start = {
            'courseid': courseid,
            'cmid': cmid,
            'type': 'vod_log',
            'track': trackid,
            'attempt': attempt,
            'state': 1, # Start
            'positionfrom': 0,
            'positionto': 0,
            'logtime': logtime
        }
        client.session.post(action_url, data=payload_log_start)
        
        # 3. Simulate Watching
        # We can just jump to the end if we want to "Watch All" quickly, 
        # but maybe we should send at least one interval update?
        # The script in mod_vod.js sends updates every 'interval' seconds.
        # It also sends a completion request after 'duration' seconds (or 'h' seconds?).
        
        # Let's try sending a completion request directly.
        # c.trackForWindow(5, duration)
        
        logger.info(f"Sending completion request for duration {duration}...")
        payload_complete = {
            'type': 'vod_track_for_onwindow',
            'track': trackid,
            'state': 5, # Complete
            'position': duration,
            'attempts': attempt,
            'interval': interval
        }
        res = client.session.post(action_url, data=payload_complete)
        logger.info(f"Completion response: {res.text}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error watching VOD: {e}")
        return False

if __name__ == "__main__":
    # Load session
    client = MoodleClient("https://ys.learnus.org", session_file="session.json")
    
    # Test VOD ID (Change this to a real one)
    # 4138580 was the one in the example
    test_vod_id = 4138580 
    
    logger.info(f"Attempting to watch VOD {test_vod_id}...")
    success = watch_vod(client, test_vod_id)
    
    if success:
        logger.info("VOD watch simulation completed.")
    else:
        logger.error("VOD watch simulation failed.")
