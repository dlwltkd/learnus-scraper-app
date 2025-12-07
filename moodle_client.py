import requests
import json
import logging
import re
import time
import html as html_lib
from datetime import datetime

class MoodleClient:
    def __init__(self, base_url, username=None, password=None, service="moodle_mobile_app", session_file=None, cookies=None):
        self.base_url = base_url
        self.username = username
        self.password = password
        self.service = service
        self.token = None
        self.user_id = None
        self.logger = logging.getLogger(__name__)
        
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        self.cookies = {}
        self.sesskey = None
        
        if cookies:
            self.set_cookies(cookies)
        elif session_file:
            self.load_session(session_file)

    def set_cookies(self, cookies, sesskey=None):
        self.cookies = cookies
        self.sesskey = sesskey
        self.session.cookies.update(self.cookies)
        if not self.sesskey:
            self.refresh_sesskey()
            
    def save_session(self, session_file):
        try:
            with open(session_file, 'w') as f:
                data = {'cookies': self.session.cookies.get_dict(), 'sesskey': self.sesskey}
                json.dump(data, f)
            return True
        except Exception as e:
            self.logger.error(f"Failed to save session: {e}")
            return False

    def parse_korean_date(self, date_str):
        if not date_str: return None
        try:
            # Unescape HTML entities (like &nbsp;)
            date_str = html_lib.unescape(date_str).strip()
            # Remove day of week if present (e.g., (월))
            date_str = re.sub(r'\([^\)]+\)', '', date_str).strip()
            
            # Format: 2025년 9월 07일
            match = re.search(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일', date_str)
            if match:
                return f"{match.group(1)}-{match.group(2).zfill(2)}-{match.group(3).zfill(2)}"
            return None
        except Exception:
            return None

    def load_session(self, session_file):
        try:
            with open(session_file, 'r') as f:
                data = json.load(f)
                self.set_cookies(data.get('cookies', {}), data.get('sesskey'))
                return True
        except Exception as e:
            self.logger.error(f"Failed to load session: {e}")
            return False

    def refresh_sesskey(self):
        try:
            response = self.session.get(self.base_url, timeout=10)
            if response.status_code == 200:
                new_sesskey = self.get_sesskey(response.text)
                if new_sesskey: self.sesskey = new_sesskey
        except Exception as e:
            self.logger.warning(f"Failed to refresh sesskey: {e}")

    def is_session_valid(self):
        try:
            res = self.session.get(f"{self.base_url}/my/", timeout=10)
            if "login/index.php" in res.url: return False
            return True
        except: return False


    def login(self, username, password):
        login_url = f"{self.base_url}/login/index.php"
        try:
            response = self.session.get(login_url, timeout=10)
            response.raise_for_status()
            match = re.search(r'<input type="hidden" name="logintoken" value="([^"]+)">', response.text)
            logintoken = match.group(1) if match else ""
            
            payload = {'username': username, 'password': password, 'logintoken': logintoken}
            response = self.session.post(login_url, data=payload, timeout=10)
            response.raise_for_status()
            
            if "login/logout.php" in response.text:
                self.username = username
                self.password = password
                self.cookies = self.session.cookies.get_dict()
                self.sesskey = self.get_sesskey(response.text)
                cookie_parts = [f"{k}={v}" for k, v in self.cookies.items()]
                return "; ".join(cookie_parts)
            else:
                raise Exception("Login failed. Check credentials.")
        except Exception as e:
            self.logger.error(f"Login error: {e}")
            raise

    def get_sesskey(self, html):
        match = re.search(r'"sesskey":"([^"]+)"', html)
        if match: return match.group(1)
        return None

    def get_user_id(self):
        """
        Scrapes dashboard to find user's Moodle ID/Profile. 
        Used to uniquely identify user from session.
        """
        # Strategy 0: Check Grade Report for user link (Most Reliable)
        try:
            url = f"{self.base_url}/grade/report/overview/index.php"
            res = self.session.get(url, timeout=10)
            if res.status_code == 200:
                match = re.search(r'href="[^"]*course/user\.php\?.*?user=(\d+)', res.text)
                if match:
                    self.logger.info(f"Found UserID via Grade Report: {match.group(1)}")
                    return int(match.group(1))
        except Exception as e:
            self.logger.warning(f"Strategy 0 (Grade Report) failed: {e}")

        try:
            res = self.session.get(f"{self.base_url}/my/", timeout=10)
            self.logger.info(f"Dashboard scrape URL: {res.url} (Status: {res.status_code})")
            
            if "login.php" in res.url:
                self.logger.warning("get_user_id redirected to login page")
                return None

            # Strategy 1: Look for Profile Link
            # It might appear multiple times, e.g. user/profile.php?id=12345
            match = re.search(r'user/profile\.php\?id=(\d+)', res.text)
            if match: 
                self.logger.info(f"Found UserID via profile link: {match.group(1)}")
                return int(match.group(1))

            # Strategy 2: Look for 'data-userid' attribute in body or other tags
            match = re.search(r'data-userid="(\d+)"', res.text)
            if match:
                self.logger.info(f"Found UserID via data-userid: {match.group(1)}")
                return int(match.group(1))

            # Strategy 3: Look for JavaScript 'userid' config
            match = re.search(r'"userid":\s*(\d+)', res.text)
            if match:
                self.logger.info(f"Found UserID via JS config: {match.group(1)}")
                return int(match.group(1))

            # Strategy 4 (Fallback): Try to get from header-user-profile URL if present
            # <a href="https://ys.learnus.org/user/profile.php?id=..." class="...">
            match = re.search(r'href=".*?/user/profile\.php\?id=(\d+)"', res.text)
            if match:
                self.logger.info(f"Found UserID via generic profile link: {match.group(1)}")
                return int(match.group(1))

            self.logger.warning("UserID not found on Dashboard. Attempting to fetch Profile page directly...")
            
            # Strategy 5 (Deep Scan): Fetch the profile page explicitly
            # We don't know the ID, but typical Moodle allows /user/profile.php without ID to redirect to self? 
            # OR we can try /user/preferences.php which usually links back to profile
            
            # 5a. Try preferences page for links
            pref_res = self.session.get(f"{self.base_url}/user/preferences.php", timeout=10)
            if pref_res.status_code == 200:
                 match = re.search(r'user/profile\.php\?id=(\d+)', pref_res.text)
                 if match:
                     self.logger.info(f"Found UserID via Preferences page: {match.group(1)}")
                     return int(match.group(1))

            # 5b. Try accessing /user/profile.php directly to see if it redirects to ?id=...
            prof_res = self.session.get(f"{self.base_url}/user/profile.php", allow_redirects=True, timeout=10)
            self.logger.info(f"Profile redirect URL: {prof_res.url}")
            match = re.search(r'id=(\d+)', prof_res.url)
            if match:
                self.logger.info(f"Found UserID via Profile Redirect: {match.group(1)}")
                return int(match.group(1))

            # Strategy 6 (Last Resort): Hash the sesskey to create a consistent pseudo-ID
            # If we are here, we are authenticated (dashboard loaded), just can't find the ID.
            # We need *some* ID to store in the DB.
            if self.sesskey:
                pseudo_id = abs(hash(self.sesskey)) % 100000000
                self.logger.warning(f"Could not find real UserID. Using pseudo-ID from sesskey: {pseudo_id}")
                return pseudo_id

            self.logger.error("FAILED to find UserID in dashboard HTML")
            # Log a larger chunk of HTML to debug structure
            self.logger.debug(f"HTML Snippet: {res.text[:4000]}...") 
            
        except Exception as e: 
            self.logger.error(f"get_user_id scraping error: {e}")
        return None

    def get_courses(self):
        if self.token:
            return self.call_api('core_course_get_enrolled_courses_by_timeline_classification', classification='all')
        elif self.session.cookies:
            return self.scrape_courses()
        else:
            raise Exception("No authentication method available.")

    def scrape_courses(self):
        """
        Scrapes the Grade Report page to find enrolled courses.
        """
        url = f"{self.base_url}/grade/report/overview/index.php"
        self.logger.info(f"Scraping courses from: {url}")
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            html = response.text
            
            # Regex to find course links
            # Pattern: href=".../course/user.php?mode=grade&id=(\d+)&user=..."
            # We relax it to capture any course/user.php link with id
            course_links = re.findall(r'href="[^"]*course/user\.php\?.*?id=(\d+).*?"[^>]*>(.*?)</a>', html)
            
            if not course_links:
                 # Fallback pattern for simple course view links if grade report structure changed
                 course_links = re.findall(r'href="[^"]*course/view\.php\?id=(\d+)"[^>]*>(.*?)</a>', html)
            
            courses = []
            seen_ids = set()
            for cid, cname in course_links:
                if cid not in seen_ids:
                    clean_name = re.sub('<[^<]+?>', '', cname).strip()
                    courses.append({'id': int(cid), 'fullname': clean_name})
                    seen_ids.add(cid)
            
            self.logger.info(f"Scraped {len(courses)} courses.")
            return courses
            
        except Exception as e:
            self.logger.error(f"Scraping failed: {e}")
            raise

    def get_course_contents(self, course_id):
        url = f"{self.base_url}/course/view.php?id={course_id}"
        self.logger.info(f"Fetching course contents from: {url}")
        try:
            response = self.session.get(url)
            response.raise_for_status()
            html = response.text
            if "login/index.php" in response.url or "Log in to the site" in html:
                raise Exception("Session expired or invalid. Please login again.")
            
            contents = {'announcements': [], 'assignments': [], 'files': [], 'boards': [], 'vods': []}
            
            announcement_items = re.finditer(r'<li class="article-list-item">\s*<a href="([^"]+)">.*?<div class="article-subject"[^>]*title="([^"]+)">.*?<div class="article-date">([^<]+)</div>', html, re.DOTALL)
            for match in announcement_items:
                link, subject, date_str = match.groups()
                contents['announcements'].append({'subject': subject, 'date': date_str.strip(), 'url': link})

            contents['announcements'].append({'subject': subject, 'date': date_str.strip(), 'url': link})

            activity_start_pattern = r'<li\s+[^>]*class="activity\s+([^"]+)"\s+id="module-(\d+)"[^>]*>'
            activity_matches = list(re.finditer(activity_start_pattern, html, re.DOTALL))
            
            for i, match in enumerate(activity_matches):
                activity_type_str, module_id = match.groups()
                start_pos = match.end()
                
                if i < len(activity_matches) - 1:
                    end_pos = activity_matches[i+1].start()
                    inner_html = html[start_pos:end_pos]
                else:
                    # Last item: scan until end of section (</ul>) or reasonable limit
                    # Since we can't easily find the closing </ul> for the section without parsing, 
                    # we'll taking a generous chunk, or search for the next section start.
                    # Moodle sections usually end with </ul><div class="summary"> or similar.
                    # We will try to find the next <li class="section main"> or </ul> that closes the list.
                    # Fallback: take next 20000 chars - sufficient for any activity info.
                    inner_html = html[start_pos:start_pos+50000]

                category = None
                if 'modtype_assign' in activity_type_str: category = 'assignments'
                elif 'modtype_ubfile' in activity_type_str: category = 'files'
                elif 'modtype_ubboard' in activity_type_str: category = 'boards'
                elif 'modtype_vod' in activity_type_str: category = 'vods'
                elif 'modtype_quiz' in activity_type_str or 'quiz' in activity_type_str: category = 'assignments'
                elif 'modtype_feedback' in activity_type_str: category = 'assignments' # Treat surveys as assignments
                
                if category:
                    name_match = re.search(r'<span class="instancename">(.*?)<', inner_html)
                    name = re.sub(r'<[^>]+>', '', name_match.group(1)).strip() if name_match else "Unknown"
                    url_match = re.search(r'href="([^"]+)"', inner_html)
                    item_url = url_match.group(1) if url_match else ""
                    is_completed = 'completion-auto-y' in inner_html or 'completion-manual-y' in inner_html or 'text-success' in inner_html
                    has_tracking = 'class="autocompletion"' in inner_html or category != 'vods'
                    item_data = {'id': int(module_id), 'name': name, 'url': item_url, 'is_completed': is_completed, 'has_tracking': has_tracking}
                    
                    if category == 'vods':
                        date_match = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*~\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})', inner_html)
                        if date_match:
                            item_data['start_date'] = date_match.group(1)
                            item_data['end_date'] = date_match.group(2)
                    elif 'modtype_feedback' in activity_type_str:
                        # Parse deadline from availability info
                        deadline_str = None
                        # Pattern 1: 종료 일시: <strong>2025년 12월 08일</strong>
                        end_match = re.search(r'종료.*?일시\s*:\s*<strong>(.*?)</strong>', inner_html, re.DOTALL | re.IGNORECASE)
                        if end_match:
                            deadline_str = end_match.group(1)
                        else:
                            # Pattern 2: <strong>2025년 9월 07일</strong> 까지 사용가능
                            until_match = re.search(r'<strong>(.*?)</strong>\s*까지\s*사용가능', inner_html, re.DOTALL | re.IGNORECASE)
                            if until_match:
                                deadline_str = until_match.group(1)
                        
                        if deadline_str:
                            item_data['deadline_text'] = self.parse_korean_date(deadline_str)
                    elif category == 'assignments':
                        due_match = re.search(r'(?:Due:|due is|deadline is|마감:|일시:|종료일시:)\s*([^<]+)', inner_html, re.IGNORECASE)
                        if due_match: item_data['deadline_text'] = due_match.group(1).strip()
                        else:
                            date_only_match = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})', inner_html)
                            item_data['deadline_text'] = date_only_match.group(1) if date_only_match else None
                    contents[category].append(item_data)
            return contents
        except Exception as e:
            self.logger.error(f"Failed to get contents: {e}")
            raise

    def get_assignment_deadline(self, url):
        try:
            response = self.session.get(url)
            html = response.text
            pattern = r'<td[^>]*>.*?(?:Due date|마감 일시|일시|Deadline).*?</td>\s*<td[^>]*>(.*?)</td>'
            match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
            if match: return re.sub(r'<[^>]+>', '', match.group(1)).strip()
            return None
        except Exception: return None

    def get_board_posts(self, board_id):
        url = f"{self.base_url}/mod/ubboard/view.php?id={board_id}"
        try:
            response = self.session.get(url)
            html = response.text
            posts = []
            tbody_match = re.search(r'<tbody>(.*?)</tbody>', html, re.DOTALL)
            if tbody_match:
                for row_match in re.finditer(r'<tr>(.*?)</tr>', tbody_match.group(1), re.DOTALL):
                    row_html = row_match.group(1)
                    link_match = re.search(r'<a href="([^"]+)">\s*(.*?)\s*</a>', row_html, re.DOTALL)
                    if link_match:
                        post_url = html_lib.unescape(link_match.group(1))
                        subject = link_match.group(2).strip()
                        tds = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
                        writer = tds[2].strip() if len(tds) >= 4 else "Unknown"
                        date_str = tds[3].strip() if len(tds) >= 4 else "Unknown"
                        posts.append({'subject': subject, 'writer': writer, 'date': date_str, 'url': post_url})
            return posts
        except Exception: return []

    def get_post_content(self, post_url):
        try:
            response = self.session.get(post_url)
            html = response.text
            content_match = re.search(r'<div class="content">.*?<div class="text_to_html">(.*?)</div>', html, re.DOTALL)
            return content_match.group(1).strip() if content_match else "No content."
        except Exception: return "Error."

    def get_quiz_details(self, url):
        try:
            response = self.session.get(url)
            html = response.text
            
            # Regex for Deadline: 종료일시 : 2025-09-20 23:59
            deadline_match = re.search(r'종료일시\s*:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})', html)
            deadline = deadline_match.group(1).strip() if deadline_match else None
            
            # Check completion
            # Simple check: if "최종 점수" (Final Score) exists or "제출됨" (Submitted)
            is_completed = False
            if "최종 점수" in html or "제출됨" in html or "마감됨" in html:
                is_completed = True
                
            return {'due_date': deadline, 'is_completed': is_completed}
        except Exception as e:
            self.logger.error(f"Error fetching quiz details for {url}: {e}")
            return None

    def sync_course_to_db(self, moodle_course_id, db_session, user_id):
        from database import Course, Assignment, VOD, FileResource, Board, Post
        course = db_session.query(Course).filter_by(moodle_id=moodle_course_id, owner_id=user_id).first()
        if not course:
            course = Course(moodle_id=moodle_course_id, owner_id=user_id, name=f"Course {moodle_course_id}")
            db_session.add(course)
            db_session.commit()
        contents = self.get_course_contents(moodle_course_id)
        
        for item in contents['assignments']:
            assign = db_session.query(Assignment).filter_by(moodle_id=item['id'], course_id=course.id).first()
            if not assign:
                assign = Assignment(moodle_id=item['id'], course_id=course.id)
                db_session.add(assign)
            assign.title = item['name']
            assign.url = item['url']
            assign.is_completed = item['is_completed']
            deadline = item.get('deadline_text')
            
            # Deep check for Quiz if deadline/completion is questionable or it's definitely a quiz
            if '/mod/quiz/' in item['url']:
                details = self.get_quiz_details(item['url'])
                if details:
                    if details['due_date']: deadline = details['due_date']
                    if details['is_completed']: assign.is_completed = True

            if not deadline and item['url'] and '/mod/assign/' in item['url']: 
                 deadline = self.get_assignment_deadline(item['url'])
                 
            assign.due_date = deadline
            
        for item in contents['vods']:
            vod = db_session.query(VOD).filter_by(moodle_id=item['id'], course_id=course.id).first()
            if not vod:
                vod = VOD(moodle_id=item['id'], course_id=course.id)
                db_session.add(vod)
            vod.title = item['name']
            vod.url = item['url']
            vod.is_completed = item['is_completed']
            vod.has_tracking = item['has_tracking']
            vod.start_date = item.get('start_date')
            vod.end_date = item.get('end_date')

        for item in contents['files']:
            fres = db_session.query(FileResource).filter_by(moodle_id=item['id'], course_id=course.id).first()
            if not fres:
                fres = FileResource(moodle_id=item['id'], course_id=course.id)
                db_session.add(fres)
            fres.title = item['name']
            fres.url = item['url']
            fres.is_completed = item['is_completed']

        for item in contents['boards']:
            board = db_session.query(Board).filter_by(moodle_id=item['id'], course_id=course.id).first()
            if not board:
                board = Board(moodle_id=item['id'], course_id=course.id)
                db_session.add(board)
            board.title = item['name']
            board.url = item['url']
            db_session.commit()
            posts = self.get_board_posts(item['id'])
            for p_item in posts:
                post = db_session.query(Post).filter_by(url=p_item['url'], board_id=board.id).first()
                if not post:
                    post = Post(url=p_item['url'], board_id=board.id)
                    db_session.add(post)
                post.title = p_item['subject']
                post.writer = p_item['writer']
                post.date = p_item['date']
                if not post.content: post.content = self.get_post_content(p_item['url'])
        db_session.commit()
        return f"Synced course {moodle_course_id}"

    def parse_progress_args(self, html):
        match = re.search(r'amd\.progress\((.*?)\);', html, re.DOTALL)
        if not match: return None
        args_str = match.group(1).replace('true', 'True').replace('false', 'False').replace(r'\/', '/')
        try:
            import ast
            return ast.literal_eval(f"[{args_str}]")
        except: return None

    def watch_vod(self, vod_id, speed=1.0):
        viewer_url = f"{self.base_url}/mod/vod/viewer.php?id={vod_id}"
        self.logger.info(f"Fetching VOD viewer: {viewer_url}")
        try:
            response = self.session.get(viewer_url)
            response.raise_for_status()
            html = response.text
            args = self.parse_progress_args(html)
            if not args:
                self.logger.error("Could not find amd.progress call.")
                return False
                
            courseid = args[6]
            cmid = args[7]
            trackid = args[8]
            attempt = args[9]
            duration = int(args[10]) or 900
            interval_ms = args[12]
            action_url = f"{self.base_url}/mod/vod/action.php"
            isProgress = args[1]
            if not isProgress: return False
            
            self.session.post(action_url, data={'type': 'vod_track_for_onwindow', 'track': trackid, 'state': 3, 'position': 0, 'attempts': attempt, 'interval': interval_ms})
            self.session.post(action_url, data={'courseid': courseid, 'cmid': cmid, 'type': 'vod_log', 'track': trackid, 'attempt': attempt, 'state': 1, 'positionfrom': 0, 'positionto': 0, 'logtime': args[22]})
            
            interval_sec = interval_ms / 1000.0
            sleep_time = interval_sec / speed
            current = 0
            while current < duration:
                # time.sleep(sleep_time) # Non-blocking in loop would be better
                # Simulate loop step
                current += interval_sec
                if current > duration: current = duration
                self.session.post(action_url, data={'courseid': courseid, 'cmid': cmid, 'type': 'vod_log', 'track': trackid, 'attempt': attempt, 'state': 8, 'positionfrom': current, 'positionto': current, 'logtime': args[22]})
            return True
        except Exception as e:
            self.logger.error(f"Watch failed: {e}")
            return False
