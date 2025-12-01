from moodle_client import MoodleClient
import re

client = MoodleClient("https://ys.learnus.org", session_file='session.json')
course_id = 277509

print("--- Checking deadline_text ---")
contents = client.get_course_contents(course_id)
for a in contents['assignments']:
    print(f"ID: {a['id']}, deadline_text: '{a.get('deadline_text')}', type: {type(a.get('deadline_text'))}")

print("\n--- Testing Regex ---")
html = """
<tr class="">
<td class="cell c0" style="">Due date</td>
<td class="cell c1 lastcol" style="">2025-09-20 23:59</td>
</tr>
"""
pattern = r'<td[^>]*>.*?(?:Due date|마감 일시|일시|Deadline).*?</td>\s*<td[^>]*>(.*?)</td>'
match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
if match:
    print(f"Match found: '{match.group(1)}'")
else:
    print("No match found.")
