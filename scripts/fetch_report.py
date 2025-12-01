import asyncio
from moodle_client import MoodleClient
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fetch_report():
    client = MoodleClient(base_url="https://ys.learnus.org", session_file="session.json")
    # Ensure we are logged in (this will load the session)
    if not client.session.cookies:
        logger.info("No session cookies found, attempting login...")
        # You might need to provide credentials if session is invalid, 
        # but for now let's assume the session file works or we can't easily login non-interactively without creds in code
        # For this script, we assume a valid session exists or we fail.
        pass

    report_url = "https://ys.learnus.org/report/ubcompletion/user_progress_a.php?id=277509"
    logger.info(f"Fetching report from {report_url}...")
    
    response = client.session.get(report_url)
    
    if response.status_code == 200:
        logger.info("Report fetched successfully.")
        with open("actual_report_277509.html", "w", encoding="utf-8") as f:
            f.write(response.text)
        logger.info("Saved to actual_report_277509.html")
    else:
        logger.error(f"Failed to fetch report. Status code: {response.status_code}")

if __name__ == "__main__":
    asyncio.run(fetch_report())
