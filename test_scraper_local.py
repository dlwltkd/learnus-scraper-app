import sys
import unittest
from unittest.mock import MagicMock
from moodle_client import MoodleClient
import os

# Force UTF-8 for Windows console
sys.stdout.reconfigure(encoding='utf-8')

class TestMoodleScraper(unittest.TestCase):
    def test_parse_date(self):
        client = MoodleClient("https://ys.learnus.org")
        # Test exact string from HTML
        date_str = "2025년 9월 07일"
        parsed = client.parse_korean_date(date_str)
        print(f"Testing parse_korean_date('{date_str}') -> '{parsed}'")
        self.assertEqual(parsed, "2025-09-07")
        
        # Test with spaces and entities (simulated)
        date_str_complex = "2025년 12월 08일 "
        parsed_complex = client.parse_korean_date(date_str_complex)
        self.assertEqual(parsed_complex, "2025-12-08")

    def test_scrape_surveys_from_local_html(self):
        # Path to local HTML
        html_path = r"c:\Users\birke\OneDrive\Desktop\projects\learnus_connect\temp_data\강좌_ 채플(D) (비대면).html"
        
        with open(html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()

        # Mock Client
        client = MoodleClient("https://ys.learnus.org")
        
        # Mock Session
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = html_content
        mock_response.url = "https://ys.learnus.org/course/view.php?id=282403"
        
        client.session.get = MagicMock(return_value=mock_response)
        
        # Run Scraper
        contents = client.get_course_contents(282403)
        
        # Verify Assignments (where surveys should be)
        assignments = contents.get('assignments', [])
        print(f"\nFound {len(assignments)} assignments (including surveys):")
        
        surveys = [a for a in assignments if "설문" in a['name'] or "소감" in a['name']]
        print(f"Found {len(surveys)} potential survey items:")
        
        for s in surveys:
            print(f" - ID: {s['id']}, Title: {s['name']}, Due: {s.get('deadline_text')}, Completed: {s['is_completed']}")

        # Assertions for specific known items
        # "1주차 소감문": Completed, Due 2025-09-07
        s1 = next((s for s in surveys if "1주차 소감문" in s['name']), None)
        self.assertIsNotNone(s1, "1주차 소감문 not found")
        self.assertTrue(s1['is_completed'], "1주차 소감문 should be completed")
        self.assertEqual(s1['deadline_text'], "2025-09-07", "1주차 소감문 deadline mismatch")
        
        # "채플 발전을 위한 2차 설문": Incomplete, Due 2025-12-08
        s2 = next((s for s in surveys if "채플 발전을 위한 2차 설문" in s['name']), None)
        self.assertIsNotNone(s2, "2차 설문 not found")
        self.assertFalse(s2['is_completed'], "2차 설문 should be incomplete")
        self.assertEqual(s2['deadline_text'], "2025-12-08", "2차 설문 deadline mismatch")

if __name__ == '__main__':
    unittest.main()
