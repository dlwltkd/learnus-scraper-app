#!/usr/bin/env python
"""
Simple script to test if the API can access Moodle vs if scripts can.
This will help diagnose the session discrepancy.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from moodle_client import MoodleClient

print("=" * 60)
print("SESSION DIAGNOSTIC TEST")
print("=" * 60)

# Test 1: Load session and inspect cookies
client = MoodleClient("https://ys.learnus.org", session_file='session.json')
print(f"\n1. Session file path: {os.path.abspath('session.json')}")
print(f"2. CWD: {os.getcwd()}")
print(f"3. Loaded cookies: {client.session.cookies.get_dict()}")
print(f"4. Sesskey: {client.sesskey}")

# Test 2: Try to fetch a known working course from the API logs (282673)
test_url = "https://ys.learnus.org/course/view.php?id=282673"
print(f"\n5. Attempting to fetch: {test_url}")
response = client.session.get(test_url)
print(f"6. Response status: {response.status_code}")
print(f"7. Response redirected to login? {'html_login' in response.text}")
print(f"8. Response has course content? {'course-content' in response.text}")

if 'html_login' in response.text:
    print("\n❌ FAILED: Script is being redirected to login page")
    print("   The session in session.json is INVALID")
else:
    print("\n✅ SUCCESS: Script can access course content")
    print("   The session in session.json is VALID")

print("=" * 60)
