import requests
import json
import logging
import re
import time
import html as html_lib
from urllib.parse import urljoin
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

    def is_session_valid(self):
        try:
            res = self.session.get(f"{self.base_url}/my/", timeout=10, allow_redirects=True)
            return "login" not in res.url
        except Exception:
            return False

    def refresh_sesskey(self):
        try:
            response = self.session.get(self.base_url, timeout=10)
            if response.status_code == 200:
                new_sesskey = self.get_sesskey(response.text)
                if new_sesskey: self.sesskey = new_sesskey
        except Exception as e:
            self.logger.warning(f"Failed to refresh sesskey: {e}")

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
            self.logger.info(
                "Grade report scrape URL: %s (Status: %s, Content-Type: %s, Length: %s)",
                res.url,
                res.status_code,
                res.headers.get("content-type", ""),
                len(res.text or ""),
            )
            if res.status_code == 200:
                self.logger.info(
                    "Grade report markers: course_user=%s user_param=%s login=%s",
                    "course/user.php" in res.text,
                    "user=" in res.text,
                    "login" in res.url.lower() or "login" in res.text[:2000].lower(),
                )
                match = re.search(r'href="[^"]*course/user\.php\?.*?user=(\d+)', res.text)
                if match:
                    self.logger.info(f"Found UserID via Grade Report: {match.group(1)}")
                    return int(match.group(1))
                self.logger.warning("Grade report loaded but no course/user.php user id matched")
                self.logger.info(f"Grade report HTML prefix: {(res.text or '')[:1200]!r}")
            else:
                self.logger.warning(f"Grade report returned non-200 status: {res.status_code}")
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

    # LearnUs role ids, from the participants page filter. 3 is 교수자(Professor); 4 is
    # 편집권한이 없는 교수, which some courses use instead, so both are tried.
    PROFESSOR_ROLE_IDS = (3, 4)

    # "CAS3106.01-00 / 김규영" — the dashboard prints the registrar code and the name in
    # one span, separated by a slash.
    _PROF_SPAN = re.compile(
        r'course/view\.php\?id=(\d+)"[^>]*class="course-link"'
        r'(?:(?!course/view\.php).)*?<span class="prof">([^<]*)</span>',
        re.S,
    )

    def get_course_professor_map(self):
        """
        Every current course's professor, from the dashboard, in one request.

        The landing page renders each enrolled course with a `.prof` span, so the whole
        semester resolves in a single fetch instead of one participants-page hit per
        course. Cached on the client for its lifetime — a sync touches many courses and
        this must not be re-fetched for each of them.

        Only covers courses on the dashboard, i.e. the current semester.
        """
        if getattr(self, '_professor_map', None) is not None:
            return self._professor_map

        self._professor_map = {}
        try:
            response = self.session.get(f"{self.base_url}/index.php?lang=ko", timeout=20)
            response.raise_for_status()
            for match in self._PROF_SPAN.finditer(response.text):
                course_id = int(match.group(1))
                # Drop the leading course code; keep the name after the slash.
                name = html_lib.unescape(match.group(2)).split('/')[-1].strip()
                if name:
                    self._professor_map[course_id] = name
            self.logger.info(f"professor map: {len(self._professor_map)} courses from dashboard")
        except Exception as e:
            self.logger.warning(f"professor map failed: {e}")

        return self._professor_map

    def get_course_professor(self, moodle_course_id):
        """
        Who teaches this course.

        Prefers the dashboard map (one request for everything). Falls back to the
        participants list for courses the dashboard does not list — past semesters —
        which is the only other place the name appears, since this Moodle has web
        services disabled and neither the course page nor the enrolment list carries it.

        Returns a name, or None when no professor is listed.
        """
        mapped = self.get_course_professor_map().get(int(moodle_course_id))
        if mapped:
            return mapped

        for role_id in self.PROFESSOR_ROLE_IDS:
            url = f"{self.base_url}/user/index.php?id={moodle_course_id}&roleid={role_id}"
            try:
                response = self.session.get(url, timeout=15)
                response.raise_for_status()
            except Exception as e:
                self.logger.warning(f"professor lookup failed for course {moodle_course_id}: {e}")
                return None

            # Each row pairs a fullname cell with a roles cell. Matching them together
            # avoids picking up a name from a page that ignored the filter.
            rows = re.findall(
                r'column-fullname[^>]*>\s*<a[^>]*>(?:<img[^>]*>)?\s*([^<]+?)\s*</a>\s*</td>\s*'
                r'<td[^>]*column-roles[^>]*>([^<]*)</td>',
                response.text,
            )
            for name, roles in rows:
                if 'Professor' in roles or '교수' in roles:
                    name = html_lib.unescape(name).strip()
                    if name:
                        return name

        return None

    def scrape_active_courses(self):
        """
        Scrapes the ubion user page to find currently active (enrolled this semester) course IDs.
        Returns a set of moodle course IDs (ints).
        """
        url = f"{self.base_url}/local/ubion/user/index.php"
        self.logger.info(f"Scraping active courses from: {url}")
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            html = response.text

            # Extract course IDs from the active course table.
            # The page lists current-semester courses as links with class="coursefullname".
            # Past courses load dynamically (via JS) so they won't appear in the static HTML.
            ids = set()
            for m in re.findall(r'course/view\.php\?id=(\d+)"[^>]*class="coursefullname"', html):
                ids.add(int(m))

            self.logger.info(f"Found {len(ids)} active course IDs from ubion page.")
            return ids
        except Exception as e:
            self.logger.error(f"scrape_active_courses failed: {e}")
            return set()

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

    def _build_section_map(self, html):
        """
        Map each module id -> the course section (week) it sits in.

        Moodle groups activities under <li id="section-N" class="section main ...">, with
        the display name in a .sectionname element — "Week 6 [06 October - 12 October]",
        or "Course Summary" for section 0. The activity lists themselves carry no back
        reference to their section, so the only way to recover it is positionally: walk
        the section boundaries and claim every module id that falls between them.

        Week is the most natural axis a student asks along ("what did week 6 cover?"), and
        it is only available here at scrape time — nothing downstream can reconstruct it.
        """
        section_starts = [
            (m.start(), int(m.group(1)))
            for m in re.finditer(r'<li[^>]*id="section-(\d+)"[^>]*class="[^"]*section\s+main', html)
        ]

        mapping = {}
        for idx, (pos, section_num) in enumerate(section_starts):
            end = section_starts[idx + 1][0] if idx + 1 < len(section_starts) else len(html)
            block = html[pos:end]

            name_match = (
                re.search(r'class="[^"]*sectionname"[^>]*>(.*?)</span>', block, re.DOTALL)
                or re.search(r'<h3[^>]*class="[^"]*sectionname[^"]*"[^>]*>(.*?)</h3>', block, re.DOTALL)
            )
            name = re.sub(r'<[^>]+>', '', name_match.group(1)).strip() if name_match else f"Section {section_num}"

            for module_id in re.findall(r'id="module-(\d+)"', block):
                mapping[int(module_id)] = {'section': section_num, 'week': name}

        return mapping

    def get_course_contents(self, course_id):
        url = f"{self.base_url}/course/view.php?id={course_id}"
        self.logger.info(f"Fetching course contents from: {url}")
        try:
            response = self.session.get(url)
            response.raise_for_status()
            html = response.text
            if "login/index.php" in response.url or "Log in to the site" in html:
                raise Exception("Session expired or invalid. Please login again.")
            
            contents = {'announcements': [], 'assignments': [], 'files': [], 'boards': [], 'vods': [], 'folders': [], 'labels': []}
            section_map = self._build_section_map(html)
            
            announcement_items = re.finditer(r'<li class="article-list-item">\s*<a href="([^"]+)">.*?<div class="article-subject"[^>]*title="([^"]+)">.*?<div class="article-date">([^<]+)</div>', html, re.DOTALL)
            for match in announcement_items:
                link, subject, date_str = match.groups()
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
                # `resource` is stock Moodle's file module; `ubfile` is the Yonsei variant.
                # Only the latter was matched, so plain file resources were being dropped.
                elif 'modtype_ubfile' in activity_type_str or 'modtype_resource' in activity_type_str: category = 'files'
                elif 'modtype_folder' in activity_type_str: category = 'folders'
                # A label is inline text printed straight onto the course page. It has no
                # link and no page of its own, which is why it matched nothing — but the
                # text is often the instructor talking to the class ("no quiz this week,
                # everyone gets full marks"), which is exactly what students ask about.
                elif 'modtype_label' in activity_type_str: category = 'labels'
                elif 'modtype_ubboard' in activity_type_str: category = 'boards'
                elif 'modtype_vod' in activity_type_str or 'modtype_laby' in activity_type_str: category = 'vods'
                elif 'modtype_quiz' in activity_type_str or 'quiz' in activity_type_str: category = 'assignments'
                elif 'modtype_feedback' in activity_type_str: category = 'assignments' # Treat surveys as assignments
                
                if category:
                    name_match = re.search(r'<span class="instancename">(.*?)<', inner_html)
                    # Unescape: titles reach us HTML-encoded, so a board called "Class Q&A"
                    # was being stored — and would have been displayed — as "Class Q&amp;A".
                    name = html_lib.unescape(re.sub(r'<[^>]+>', '', name_match.group(1))).strip() if name_match else "Unknown"
                    url_match = re.search(r'href="([^"]+)"', inner_html)
                    item_url = url_match.group(1) if url_match else ""
                    if 'modtype_laby' in activity_type_str:
                        laby_viewer_match = re.search(r"window\.open\('(/mod/laby/viewer\.php\?i=\d+)'", inner_html)
                        if laby_viewer_match:
                            item_url = f"{self.base_url}{laby_viewer_match.group(1)}"
                    elif 'modtype_vod' in activity_type_str:
                        item_url = f"{self.base_url}/mod/vod/viewer.php?id={module_id}"
                    is_completed = 'completion-auto-y' in inner_html or 'completion-manual-y' in inner_html or 'text-success' in inner_html
                    has_tracking = 'class="autocompletion"' in inner_html or category != 'vods'
                    section_info = section_map.get(int(module_id), {})
                    item_data = {
                        'id': int(module_id), 'name': name, 'url': item_url,
                        'is_completed': is_completed, 'has_tracking': has_tracking,
                        'section': section_info.get('section'),
                        'week': section_info.get('week'),
                    }
                    
                    if category == 'vods':
                        date_match = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*~\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})', inner_html)
                        if date_match:
                            item_data['start_date'] = date_match.group(1)
                            item_data['end_date'] = date_match.group(2)
                        # Parse video duration — appears after the date range, e.g. "...), 01:00:22"
                        dur_match = re.search(r',\s*(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s|$|<)', inner_html)
                        if dur_match:
                            if dur_match.group(3) is not None:
                                item_data['duration'] = int(dur_match.group(1)) * 3600 + int(dur_match.group(2)) * 60 + int(dur_match.group(3))
                            else:
                                item_data['duration'] = int(dur_match.group(1)) * 60 + int(dur_match.group(2))
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
                    if category == 'labels':
                        body = re.search(r'<div class="contentwithoutlink[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>',
                                         inner_html, re.DOTALL)
                        text = body.group(1) if body else inner_html
                        text = re.sub(r'<br\s*/?>', '\n', text)
                        text = re.sub(r'</p>', '\n', text)
                        text = re.sub(r'<[^>]+>', ' ', text)
                        text = html_lib.unescape(text)
                        text = re.sub(r'[ \t]+', ' ', text)
                        text = re.sub(r'\n{3,}', '\n\n', text).strip()

                        if len(text) >= 15:
                            # No download to do — the text is already here, so it is stored
                            # inline and the corpus build skips fetching it.
                            item_data['name'] = (text.split('\n')[0][:60] or '안내').strip()
                            item_data['url'] = None
                            item_data['inline_content'] = text
                            contents['files'].append(item_data)
                    elif category == 'folders':
                        # A folder is a container, not a document. Expand it into its
                        # files so each is separately stored, extracted and citable, and
                        # inherit the folder's week so they land in the right place.
                        for contained in self.get_folder_files(module_id):
                            contained['section'] = item_data.get('section')
                            contained['week'] = item_data.get('week')
                            contents['files'].append(contained)
                    else:
                        contents[category].append(item_data)
            return contents
        except Exception as e:
            self.logger.error(f"Failed to get contents: {e}")
            raise

    def get_folder_files(self, folder_module_id):
        """
        Enumerate the files inside a Moodle `folder` module.

        Folders were matched by no branch in the course parser, so their contents were
        invisible — and they are not marginal: one course carries 13 folders, each holding
        ~3 PDFs, all of them 강의안 lecture notes. That is the single highest-value content
        type on the course, and none of it was reaching the database.

        Contained files get a derived id (folder id * 100 + index) so each is individually
        addressable and stable across syncs, since Moodle exposes no module id for them.
        """
        url = f"{self.base_url}/mod/folder/view.php?id={folder_module_id}"
        try:
            page = self.session.get(url, timeout=30).text
        except Exception as e:
            self.logger.warning(f"get_folder_files failed for {folder_module_id}: {e}")
            return []

        name_match = re.search(r'<h2[^>]*>(.*?)</h2>', page, re.DOTALL)
        folder_name = re.sub(r'<[^>]+>', '', name_match.group(1)).strip() if name_match else 'folder'

        from urllib.parse import unquote
        files = []
        for index, file_url in enumerate(dict.fromkeys(re.findall(r'https://[^"]*pluginfile\.php/[^"?]+', page))):
            filename = unquote(file_url.rsplit('/', 1)[-1])
            files.append({
                'id': int(folder_module_id) * 100 + index,
                'name': f"{folder_name} / {filename}",
                'url': file_url,
                'is_completed': False,
                'has_tracking': False,
            })
        return files

    def get_assignment_detail(self, url):
        """
        Fetch an assignment's instructions.

        The course page only carries a title and a deadline, so anything asking "what do I
        actually have to do for HW3?" had nothing to work from. The body lives in the
        activity's own page, in the standard Moodle `#intro` container — verified present
        on every assignment across the sample course, yielding 180-830 characters of real
        instructions.

        Costs one request per assignment, so callers should fetch lazily and store the
        result rather than doing this on every sync.
        """
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            page = response.text

            match = (
                re.search(r'<div[^>]*id="intro"[^>]*>(.*?)</div>\s*</div>', page, re.DOTALL)
                or re.search(r'<div[^>]*class="[^"]*no-overflow[^"]*"[^>]*>(.*?)</div>', page, re.DOTALL)
            )
            if not match:
                return {'description': None, 'attachments': []}

            text = re.sub(r'<br\s*/?>', '\n', match.group(1))
            text = re.sub(r'</p>', '\n', text)
            text = re.sub(r'<[^>]+>', ' ', text)
            text = html_lib.unescape(text)
            text = re.sub(r'[ \t]+', ' ', text)
            text = re.sub(r'\n{3,}', '\n\n', text).strip()

            # Instructor-supplied handouts only. A student's own uploaded submission also
            # appears as a pluginfile link and is not part of the assignment's content.
            attachments = [
                u for u in dict.fromkeys(re.findall(r'https://[^"]*pluginfile\.php[^"]*', page))
                if 'assignsubmission' not in u
            ]

            return {'description': text or None, 'attachments': attachments}
        except Exception as e:
            self.logger.warning(f"get_assignment_detail failed for {url}: {e}")
            return {'description': None, 'attachments': []}

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

        # One-time per course: the participants list is a separate request, and the
        # teaching staff does not change mid-semester. professor_fetched_at is stamped
        # even when nothing is found, so a course with no listed professor is not
        # re-queried on every sync forever.
        if course.professor_fetched_at is None:
            try:
                from datetime import datetime as _dt
                course.professor = self.get_course_professor(moodle_course_id)
                course.professor_fetched_at = _dt.now()
                db_session.commit()
            except Exception as e:
                db_session.rollback()
                self.logger.warning(f"professor lookup skipped for {moodle_course_id}: {e}")

        contents = self.get_course_contents(moodle_course_id)
        
        for item in contents['assignments']:
            assign = db_session.query(Assignment).filter_by(moodle_id=item['id'], course_id=course.id).first()
            if not assign:
                assign = Assignment(moodle_id=item['id'], course_id=course.id)
                db_session.add(assign)
            assign.title = item['name']
            assign.url = item['url']
            assign.section = item.get('section')
            assign.week = item.get('week')
            if not assign.completion_overridden:
                assign.is_completed = item['is_completed']
            deadline = item.get('deadline_text')
            
            # Deep check for Quiz if deadline/completion is questionable or it's definitely a quiz
            if '/mod/quiz/' in item['url']:
                details = self.get_quiz_details(item['url'])
                if details:
                    if details['due_date']: deadline = details['due_date']
                    if details['is_completed'] and not assign.completion_overridden:
                        assign.is_completed = True

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
            vod.section = item.get('section')
            vod.week = item.get('week')
            vod.is_completed = item['is_completed']
            vod.has_tracking = item['has_tracking']
            vod.start_date = item.get('start_date')
            vod.end_date = item.get('end_date')
            if item.get('duration'):
                vod.duration = item['duration']

        for item in contents['files']:
            fres = db_session.query(FileResource).filter_by(moodle_id=item['id'], course_id=course.id).first()
            if not fres:
                fres = FileResource(moodle_id=item['id'], course_id=course.id)
                db_session.add(fres)
            fres.title = item['name']
            fres.url = item['url']
            fres.section = item.get('section')
            fres.week = item.get('week')
            # Label text lives on the course page itself, so it is complete at sync time
            # and needs no download or extraction pass.
            if item.get('inline_content'):
                fres.content = item['inline_content']
                fres.content_chars = len(item['inline_content'])
                fres.file_kind = 'label'
                fres.extract_status = 'ok'
                fres.extracted_at = datetime.now()
            fres.is_completed = item['is_completed']

        for item in contents['boards']:
            board = db_session.query(Board).filter_by(moodle_id=item['id'], course_id=course.id).first()
            if not board:
                board = Board(moodle_id=item['id'], course_id=course.id)
                db_session.add(board)
            board.title = item['name']
            board.url = item['url']
            board.section = item.get('section')
            board.week = item.get('week')
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

    def get_vod_stream_url(self, vod_moodle_id, viewer_url=None):
        """
        Fetches the VOD viewer page and extracts the HLS .m3u8 stream URL.
        Returns the URL string or None if not found.
        """
        viewer_url = viewer_url or f"{self.base_url}/mod/vod/viewer.php?id={vod_moodle_id}"
        self.logger.info(f"Fetching VOD viewer for stream URL: {viewer_url}")
        try:
            response = self.session.get(viewer_url, timeout=15, allow_redirects=True)
            response.raise_for_status()
            html = response.text

            if "login" in str(response.url) or "login/index.php" in html:
                self.logger.warning(
                    f"Viewer request appears unauthenticated for VOD {vod_moodle_id} (final_url={response.url})"
                )
                return None

            patterns = [
                r'<source[^>]+src=["\']([^"\']+\.m3u8(?:\?[^"\']*)?)["\']',
                r'["\']file["\']\s*:\s*["\']([^"\']+\.m3u8(?:\?[^"\']*)?)["\']',
                r'["\']src["\']\s*:\s*["\']([^"\']+\.m3u8(?:\?[^"\']*)?)["\']',
                r'(https?:\\?/\\?/[^"\']+\.m3u8(?:\?[^"\']*)?)',
                r'(/[^"\']+\.m3u8(?:\?[^"\']*)?)',
            ]

            for pattern in patterns:
                match = re.search(pattern, html, re.IGNORECASE)
                if not match:
                    continue
                url = html_lib.unescape(match.group(1)).replace(r"\/", "/").strip()
                if url.startswith("//"):
                    url = "https:" + url
                elif url.startswith("/"):
                    url = urljoin(str(response.url), url)
                elif not re.match(r"^https?://", url, re.IGNORECASE):
                    url = urljoin(str(response.url), url)
                self.logger.info(f"Found .m3u8 URL: {url}")
                return url

            self.logger.warning(f"No .m3u8 found in viewer page for VOD {vod_moodle_id}")
            return None
        except Exception as e:
            self.logger.error(f"get_vod_stream_url failed for VOD {vod_moodle_id}: {e}")
            return None

    def _watch_laby(self, vod_id, viewer_url, duration=None):
        """Watch a laby-type VOD.
        Tracking flow (from lab.MainApp.js):
        1. POST to /mod/laby/action.php with state=3 (start)
        2. POST to /webservice/rest/server.php with wsfunction=mod_laby_track, state=3 (play)
        3. POST periodic state=8 ticks every intervalTime seconds
        4. POST state=10 (ended)
        """
        self.logger.info(f"Fetching laby viewer: {viewer_url}")
        try:
            response = self.session.get(viewer_url, headers={"Referer": self.base_url})
            response.raise_for_status()
            html = response.text

            is_progress = re.search(r'var\s+is_progress\s*=\s*(\d+)', html)
            if not is_progress or is_progress.group(1) == '0':
                self.logger.info(f"Laby VOD {vod_id} has no progress tracking, skipping.")
                return False

            # Parse action.php tracking params
            track_match = re.search(r'"track"\s*:\s*(\d+)', html)
            attempts_match = re.search(r'"attempts"\s*:\s*(\d+)', html)
            interval_match = re.search(r'"interval"\s*:\s*(\d+)', html)
            if not track_match:
                self.logger.error(f"Could not find track ID in laby viewer for VOD {vod_id}")
                return False
            track_id = track_match.group(1)
            attempts = attempts_match.group(1) if attempts_match else '1'
            interval_sec = int(interval_match.group(1)) if interval_match else 60

            # Parse webservice params from redirect URL
            redirect_match = re.search(r'location\.href\s*=\s*"([^"]+)"', html)
            wstoken = asskey = att = cmsid = None
            if redirect_match:
                redirect_url = redirect_match.group(1)
                wstoken = (re.search(r'rskey=([^&]+)', redirect_url) or [None, None])[1]
                asskey  = (re.search(r'asskey=([^&]+)', redirect_url) or [None, None])[1]
                att     = (re.search(r'att=([^&]+)', redirect_url) or [None, None])[1]
                cmsid   = (re.search(r'cmsid=([^&]+)', redirect_url) or [None, None])[1]
                # Parse duration from cpltime if not provided (format MM:SS or HH:MM:SS)
                if not duration:
                    cpltime = (re.search(r'cpltime=([^&]+)', redirect_url) or [None, None])[1]
                    if cpltime:
                        parts = cpltime.split(':')
                        if len(parts) == 2:
                            duration = int(parts[0]) * 60 + int(parts[1])
                        elif len(parts) == 3:
                            duration = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])

            action_url = f"{self.base_url}/mod/laby/action.php"
            ws_url = f"{self.base_url}/webservice/rest/server.php"
            has_ws = all([wstoken, asskey, att, cmsid])

            def send_ws(state, pos_old, pos_new):
                if not has_ws:
                    return
                self.session.post(ws_url, data={
                    'wstoken': wstoken, 'wsfunction': 'mod_laby_track',
                    'moodlewsrestformat': 'json',
                    'asskey': asskey, 'att': att, 'cmsid': cmsid,
                    'state': state, 'positionold': pos_old, 'positionnew': pos_new,
                })

            # 1. action.php start signal
            r = self.session.post(action_url, headers={"Referer": viewer_url}, data={
                'type': 'track_for_onwindow', 'track': track_id,
                'state': 3, 'position': 0, 'attempts': attempts, 'interval': interval_sec,
            })
            self.logger.info(f"Laby VOD {vod_id} action.php state=3: {r.text[:80]}")

            # 2. Webservice play signal
            send_ws(3, 0, 0)

            if not duration:
                self.logger.warning(f"Laby VOD {vod_id}: no duration, sending ended signal immediately")
                send_ws(10, 0, 0)
                return True

            # 3. Periodic ticks
            pos = 0
            while pos < duration:
                time.sleep(interval_sec)
                pos = min(pos + interval_sec, duration)
                send_ws(8, pos - interval_sec, pos)

            # 4. Ended
            send_ws(10, duration, duration)
            self.logger.info(f"Laby VOD {vod_id} watch complete.")
            return True
        except Exception as e:
            self.logger.error(f"_watch_laby failed for VOD {vod_id}: {e}")
            return False

    def watch_vod(self, vod_id, duration=None, viewer_url=None):
        """Watch a VOD by replicating the exact signals the browser sends.
        - logtime = args[22] (page load time), constant throughout
        - positionfrom == positionto == current video position
        - state=3 play, state=8 periodic tick, state=10 ended
        - vod_track_for_onwindow state=99 sent after every vod_log
        - duration: real video length in seconds (from DB); overrides args[10] if provided
        - viewer_url: override the viewer URL (required for laby-type VODs)
        """
        if viewer_url and '/mod/laby/' in viewer_url:
            return self._watch_laby(vod_id, viewer_url, duration=duration)
        viewer_url = viewer_url or f"{self.base_url}/mod/vod/viewer.php?id={vod_id}"
        self.logger.info(f"Fetching VOD viewer: {viewer_url}")
        try:
            response = self.session.get(viewer_url, headers={"Referer": self.base_url})
            response.raise_for_status()
            html = response.text
            args = self.parse_progress_args(html)
            if not args:
                self.logger.error(f"Could not find amd.progress call. URL={response.url} Snippet={html[:300]!r}")
                return False

            if not args[1]:
                self.logger.info(f"VOD {vod_id} has no progress tracking, skipping.")
                return False

            courseid     = args[6]
            cmid         = args[7]
            trackid      = args[8]
            attempt      = args[9]
            raw_duration = int(args[10])
            alt_duration = int(args[17]) if len(args) > 17 and args[17] else 0
            args_duration = max(raw_duration, alt_duration) or 2000
            if not duration:
                duration = args_duration
            interval_ms  = args[12]
            interval_sec = interval_ms / 1000.0
            logtime      = args[22]  # page-load timestamp, stays constant

            self.logger.info(f"VOD {vod_id}: duration={duration}s interval={interval_sec}s attempt={attempt}")

            action_url = f"{self.base_url}/mod/vod/action.php"
            ajax_headers = {
                "Referer": viewer_url,
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            }
            sesskey = self.sesskey or ""

            def vod_log(state, pos):
                r = self.session.post(action_url, headers=ajax_headers, data={
                    'sesskey': sesskey, 'courseid': courseid, 'cmid': cmid,
                    'type': 'vod_log', 'track': trackid, 'attempt': attempt,
                    'state': state, 'positionfrom': pos, 'positionto': pos,
                    'logtime': logtime,
                })
                self.logger.info(f"VOD {vod_id} vod_log state={state} pos={pos:.1f}: {r.text[:80]}")

            def onwindow(pos):
                self.session.post(action_url, headers=ajax_headers, data={
                    'sesskey': sesskey, 'type': 'vod_track_for_onwindow',
                    'track': trackid, 'state': 99,
                    'position': pos, 'attempts': attempt, 'interval': interval_ms,
                })

            # 1. Play from position 0
            vod_log(3, 0)
            onwindow(0)

            # 2. Periodic ticks — sleep the real interval between each, exactly as a browser would
            pos = 0.0
            while pos < duration:
                time.sleep(interval_sec)
                pos = min(pos + interval_sec, duration)
                vod_log(8, pos)
                onwindow(pos)

            # 3. Video ended
            vod_log(10, duration)
            onwindow(duration)

            self.logger.info(f"VOD {vod_id} watch complete.")
            return True
        except Exception as e:
            self.logger.error(f"Watch failed: {e}")
            return False
