import requests
import json
import logging
import re

class MoodleClient:
    def __init__(self, base_url, username=None, password=None, service="moodle_mobile_app", session_file=None):
        self.base_url = base_url
        self.username = username
        self.password = password
        self.service = service
        self.token = None
        self.user_id = None
        self.logger = logging.getLogger(__name__)
        
        self.session = requests.Session()
        self.cookies = {}
        self.sesskey = None
        
        if session_file:
            self.load_session(session_file)

    def load_session(self, session_file):
        try:
            with open(session_file, 'r') as f:
                data = json.load(f)
                self.cookies = data.get('cookies', {})
                self.sesskey = data.get('sesskey')
                self.session.cookies.update(self.cookies)
                self.logger.info("Session loaded from file.")
        except Exception as e:
            self.logger.error(f"Failed to load session: {e}")

    def login(self, username, password):
        """
        Logs in using username and password.
        Returns the cookie string on success.
        """
        login_url = f"{self.base_url}/login/index.php"
        
        try:
            # 1. Get the login page to get the logintoken
            response = self.session.get(login_url, timeout=10)
            response.raise_for_status()
            
            # Scrape logintoken
            # <input type="hidden" name="logintoken" value="xxx">
            match = re.search(r'<input type="hidden" name="logintoken" value="([^"]+)">', response.text)
            logintoken = match.group(1) if match else ""
            
            # 2. Post credentials
            payload = {
                'username': username,
                'password': password,
                'logintoken': logintoken
            }
            
            response = self.session.post(login_url, data=payload, timeout=10)
            response.raise_for_status()
            
            # 3. Check success
            # If we are redirected to the dashboard (or /my/), it's a success
            # Or check for "Log out" string
            if "login/logout.php" in response.text:
                self.username = username
                self.password = password
                
                # Construct cookie string
                cookie_parts = []
                for cookie in self.session.cookies:
                    cookie_parts.append(f"{cookie.name}={cookie.value}")
                
                cookie_string = "; ".join(cookie_parts)
                self.cookies = self.session.cookies.get_dict()
                self.sesskey = self.get_sesskey(response.text)
                
                self.logger.info(f"Login successful for {username}")
                return cookie_string
            else:
                raise Exception("Login failed. Check credentials.")
                
        except Exception as e:
            self.logger.error(f"Login error: {e}")
            raise

    def get_sesskey(self, html):
        # sesskey":"Ag5...
        match = re.search(r'"sesskey":"([^"]+)"', html)
        if match:
            return match.group(1)
        return None

    def get_courses(self):
        """
        Retrieves courses. Tries API first, then scraping.
        """
        if self.token:
            return self.call_api('core_course_get_enrolled_courses_by_timeline_classification', classification='all')
        elif self.cookies:
            return self.scrape_courses()
        else:
            raise Exception("No authentication method available (Token or Session).")

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
            course_links = re.findall(r'href="[^"]*course/user\.php\?mode=grade&amp;id=(\d+)&amp;user=\d+"[^>]*>(.*?)</a>', html)
            
            if not course_links:
                 # Fallback pattern
                 course_links = re.findall(r'id=(\d+)&amp;user=\d+"[^>]*>(.*?)</a>', html)
            
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

    def get_assignments(self, course_id):
        """
        Scrapes assignments for a specific course.
        Returns a list of dicts with id, name, and completion status.
        """
        url = f"{self.base_url}/course/view.php?id={course_id}"
        self.logger.info(f"Fetching assignments from: {url}")
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            html = response.text
            
            # Find all assignment list items
            # Pattern looks for li with class containing 'modtype_assign'
            # We capture the ID from the li id attribute (module-XXXX) and the inner content
            assign_items = re.finditer(r'<li\s+[^>]*class="[^"]*modtype_assign[^"]*"[^>]*id="module-(\d+)"[^>]*>(.*?)</li>', html, re.DOTALL)
            
            assignments = []
            for match in assign_items:
                aid = match.group(1)
                content = match.group(2)
                
                # Extract Name
                # Look for <span class="instancename">...<
                name_match = re.search(r'<span class="instancename">(.*?)<', content)
                if name_match:
                    raw_name = name_match.group(1)
                    # Remove any nested tags like <span class="accesshide">...</span>
                    clean_name = re.sub(r'<[^>]+>', '', raw_name).strip()
                else:
                    clean_name = "Unknown Assignment"
                
                # Extract Completion Status
                # Look for alt="Completed: ..." or alt="Not completed: ..."
                # This relies on the completion icon being present with this alt text
                is_completed = False
                if 'alt="Completed:' in content:
                    is_completed = True
                
                assignments.append({
                    'id': int(aid),
                    'name': clean_name,
                    'is_completed': is_completed
                })
            
            self.logger.info(f"Found {len(assignments)} assignments for course {course_id}.")
            return assignments
            
        except Exception as e:
            self.logger.error(f"Failed to get assignments for course {course_id}: {e}")
            raise

    def get_course_contents(self, course_id):
        """
        Scrapes all resources (assignments, files, boards, vods) for a specific course.
        Returns a dict with categorized lists.
        """
        url = f"{self.base_url}/course/view.php?id={course_id}"
        self.logger.info(f"Fetching course contents from: {url}")
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            html = response.text
            
            # Check if we were redirected to login
            if "login/index.php" in response.url or '<form action="https://ys.learnus.org/login/index.php"' in html or "Log in to the site" in html:
                raise Exception("Session expired or invalid. Please login again.")
            
            contents = {
                'announcements': [],
                'assignments': [],
                'files': [],
                'boards': [],
                'vods': []
            }
            
            # --- 1. Scrape Announcements (from the top of the page) ---
            # Pattern: <li class="article-list-item">...<a href="...">...<div class="article-subject" title="...">...<div class="article-date">...
            announcement_items = re.finditer(r'<li class="article-list-item">\s*<a href="([^"]+)">.*?<div class="article-subject"[^>]*title="([^"]+)">.*?<div class="article-date">([^<]+)</div>', html, re.DOTALL)
            
            for match in announcement_items:
                link = match.group(1)
                subject = match.group(2)
                date_str = match.group(3).strip()
                contents['announcements'].append({
                    'subject': subject,
                    'date': date_str,
                    'url': link
                })

            # --- 2. Scrape Activities (Assignments, Files, VODs, Boards) ---
            # Regex to find all activity list items
            # Captures: 1=Type class, 2=Module ID, 3=Inner HTML
            activity_pattern = r'<li\s+[^>]*class="activity\s+([^"]+)"\s+id="module-(\d+)"[^>]*>(.*?)</li>'
            
            for match in re.finditer(activity_pattern, html, re.DOTALL):
                activity_type_str = match.group(1)
                module_id = match.group(2)
                inner_html = match.group(3)
                
                # Determine category
                category = None
                if 'modtype_assign' in activity_type_str:
                    category = 'assignments'
                elif 'modtype_ubfile' in activity_type_str:
                    category = 'files'
                elif 'modtype_ubboard' in activity_type_str:
                    category = 'boards'
                elif 'modtype_vod' in activity_type_str:
                    category = 'vods'
                
                if category:
                    # Extract Name
                    name_match = re.search(r'<span class="instancename">(.*?)<', inner_html)
                    name = "Unknown"
                    if name_match:
                        # Remove any nested tags like <span class="accesshide">...</span>
                        name = re.sub(r'<[^>]+>', '', name_match.group(1)).strip()
                        
                    # Extract URL
                    url_match = re.search(r'href="([^"]+)"', inner_html)
                    item_url = url_match.group(1) if url_match else ""
                    
                    # Extract Completion Status
                    # Check for "completion-auto-y" or "completion-manual-y" in image src
                    is_completed = False
                    has_tracking = True
                    
                    # Check if tracking is enabled (look for autocompletion span)
                    if 'class="autocompletion"' not in inner_html and category == 'vods':
                        has_tracking = False
                    
                    if 'completion-auto-y' in inner_html or 'completion-manual-y' in inner_html:
                        is_completed = True
                    # Fallback: Check for "Completed" or "완료" in alt text
                    elif 'alt="Completed:' in inner_html or 'alt="완료:' in inner_html:
                        is_completed = True
                    # Fallback 2: Check for text-success class
                    elif 'text-success' in inner_html and ('Completed' in inner_html or '완료' in inner_html):
                        is_completed = True
                    
                    item_data = {
                        'id': int(module_id),
                        'name': name,
                        'url': item_url,
                        'is_completed': is_completed,
                        'has_tracking': has_tracking
                    }
                    
                    # --- Extract Deadlines ---
                    if category == 'vods':
                        # Look for date range in text-ubstrap
                        # Example: 2025-09-22 00:00:00 ~ 2025-09-28 23:59:59
                        date_match = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*~\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})', inner_html)
                        if date_match:
                            item_data['start_date'] = date_match.group(1)
                            item_data['end_date'] = date_match.group(2)
                        else:
                            item_data['start_date'] = None
                            item_data['end_date'] = None
                            
                    elif category == 'assignments':
                        # Look for "Due" or "deadline" or "마감" in the description text
                        # Regex tries to capture "Due: ..." or "deadline is ..." or "마감: ..."
                        # We try to capture a date-like string
                        
                        # English: Due: Friday, 12 October 2025, 11:59 PM
                        # Korean: 마감: 2025년 10월 12일 (금) 23:59
                        
                        due_match = re.search(r'(?:Due:|due is|deadline is|마감:|일시:)\s*([^<]+)', inner_html, re.IGNORECASE)
                        if due_match:
                            item_data['deadline_text'] = due_match.group(1).strip()
                        else:
                            # Try to find just a date pattern if the prefix is missing or different
                            # YYYY-MM-DD HH:MM
                            date_only_match = re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})', inner_html)
                            if date_only_match:
                                item_data['deadline_text'] = date_only_match.group(1)
                            else:
                                item_data['deadline_text'] = None

                    contents[category].append(item_data)
            
            self.logger.info(f"Scraped course {course_id}: {len(contents['announcements'])} announcements, {len(contents['assignments'])} assigns, {len(contents['files'])} files, {len(contents['boards'])} boards, {len(contents['vods'])} vods.")
            return contents
            
        except Exception as e:
            self.logger.error(f"Failed to get contents for course {course_id}: {e}")
            raise

    def get_board_posts(self, board_id):
        """
        Scrapes the list of posts from a board page.
        Returns a list of dicts: {subject, writer, date, url, id}.
        """
        url = f"{self.base_url}/mod/ubboard/view.php?id={board_id}"
        self.logger.info(f"Fetching board posts from: {url}")
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            html = response.text
            
            posts = []
            
            # Find the table body
            tbody_match = re.search(r'<tbody>(.*?)</tbody>', html, re.DOTALL)
            if not tbody_match:
                self.logger.warning(f"No post table found for board {board_id}")
                return []
                
            tbody_content = tbody_match.group(1)
            
            # Iterate over rows
            # Pattern: <tr>...<td...>(num)</td>...<a href="(url)">(title)</a>...<td...>(writer)</td>...<td...>(date)</td>...</tr>
            # We'll parse row by row for safety
            row_pattern = r'<tr>(.*?)</tr>'
            
            for row_match in re.finditer(row_pattern, tbody_content, re.DOTALL):
                row_html = row_match.group(1)
                
                # Extract Link and Title
                link_match = re.search(r'<a href="([^"]+)">\s*(.*?)\s*</a>', row_html, re.DOTALL)
                if not link_match:
                    continue
                    
                import html as html_lib
                post_url = html_lib.unescape(link_match.group(1))
                subject = link_match.group(2).strip()
                
                # Extract Writer (3rd column usually, but let's look for the text)
                # The writer is in a <td class="tcenter">...</td> but so is date and hit.
                # Writer is usually the first text-only td after the title td? 
                # Let's use a more specific regex for the row structure if possible, or just find all tds.
                
                tds = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
                if len(tds) >= 4:
                    writer = tds[2].strip()
                    date_str = tds[3].strip()
                else:
                    writer = "Unknown"
                    date_str = "Unknown"
                
                posts.append({
                    'subject': subject,
                    'writer': writer,
                    'date': date_str,
                    'url': post_url
                })
                
            self.logger.info(f"Found {len(posts)} posts in board {board_id}.")
            return posts
            
        except Exception as e:
            self.logger.error(f"Failed to get posts for board {board_id}: {e}")
            raise

    def get_post_content(self, post_url):
        """
        Scrapes the content of a specific post.
        Returns the HTML content as a string.
        """
        self.logger.info(f"Fetching post content from: {post_url}")
        
        try:
            response = self.session.get(post_url)
            response.raise_for_status()
            html = response.text
            
            # Extract content
            # Look for <div class="content">...<div class="text_to_html">(.*?)</div>
            content_match = re.search(r'<div class="content">.*?<div class="text_to_html">(.*?)</div>', html, re.DOTALL)
            
            if content_match:
                return content_match.group(1).strip()
            else:
                return "No content found."
                
        except Exception as e:
            self.logger.error(f"Failed to get post content: {e}")
            return f"Error: {e}"

        try:
            response = requests.post(endpoint, data=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            self.logger.error(f"API call failed: {e}")
            raise

    def get_assignment_deadline(self, url):
        """
        Fetches the assignment detail page and extracts the due date.
        """
        self.logger.info(f"Fetching assignment details from: {url}")
        try:
            response = self.session.get(url)
            response.raise_for_status()
            html = response.text
            
            # Look for Due date row in the table
            # <tr ...><td ...>Due date</td><td ...>2024-09-27 17:00</td></tr>
            # Keywords: Due date, 마감 일시, 일시, Deadline
            
            # We use a broad regex to capture the row
            # 1. Find the cell with the label
            # 2. Find the next cell with the value
            
            # Regex explanation:
            # <td[^>]*>.*? (Due date|...) .*?</td>  --> Label cell
            # \s*                                   --> Whitespace
            # <td[^>]*>(.*?)</td>                   --> Value cell
            
            pattern = r'<td[^>]*>.*?(?:Due date|마감 일시|일시|Deadline).*?</td>\s*<td[^>]*>(.*?)</td>'
            match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
            
            if match:
                # Clean up the date string
                date_str = re.sub(r'<[^>]+>', '', match.group(1)).strip()
                return date_str
            
            return None
            
        except Exception as e:
            self.logger.error(f"Failed to get assignment deadline: {e}")
            return None

    def sync_course_to_db(self, course_id, db_session):
        """
        Scrapes course contents and syncs them to the database.
        """
        from database import Course, Assignment, VOD, FileResource, Board, Post
        
        # 1. Get or Create Course
        course = db_session.query(Course).filter_by(id=course_id).first()
        if not course:
            # We need the course name. We can get it from get_courses() or just use a placeholder if not found.
            # For now, let's assume it exists or create with a placeholder.
            # Ideally, we should fetch course info first.
            course = Course(id=course_id, name=f"Course {course_id}")
            db_session.add(course)
            db_session.commit() # Commit to get the ID if needed (though we set it manually)
            
        # 2. Get Contents
        contents = self.get_course_contents(course_id)
        
        # 3. Sync Assignments
        for item in contents['assignments']:
            assign = db_session.query(Assignment).filter_by(id=item['id']).first()
            if not assign:
                assign = Assignment(id=item['id'], course_id=course_id)
                db_session.add(assign)
            
            assign.title = item['name']
            assign.url = item['url']
            assign.is_completed = item['is_completed']
            
            deadline = item.get('deadline_text')
            
            # If deadline is missing, try deep scraping
            if not deadline and item['url']:
                self.logger.info(f"Deep scraping for assignment {item['id']}...")
                deadline = self.get_assignment_deadline(item['url'])
                self.logger.info(f"Deep scrape result: {deadline}")
                
            assign.due_date = deadline
            
        # 4. Sync VODs
        for item in contents['vods']:
            vod = db_session.query(VOD).filter_by(id=item['id']).first()
            if not vod:
                vod = VOD(id=item['id'], course_id=course_id)
                db_session.add(vod)
                
            vod.title = item['name']
            vod.url = item['url']
            vod.is_completed = item['is_completed']
            vod.has_tracking = item.get('has_tracking', True)
            vod.start_date = item.get('start_date')
            vod.end_date = item.get('end_date')

        # 5. Sync Files
        for item in contents['files']:
            fres = db_session.query(FileResource).filter_by(id=item['id']).first()
            if not fres:
                fres = FileResource(id=item['id'], course_id=course_id)
                db_session.add(fres)
                
            fres.title = item['name']
            fres.url = item['url']
            fres.is_completed = item['is_completed']

        # 6. Sync Boards and Posts
        for item in contents['boards']:
            board = db_session.query(Board).filter_by(id=item['id']).first()
            if not board:
                board = Board(id=item['id'], course_id=course_id)
                db_session.add(board)
            
            board.title = item['name']
            board.url = item['url']
            db_session.commit() # Commit board to ensure ID is available
            
            # Fetch posts for this board
            try:
                posts = self.get_board_posts(item['id'])
                for p_item in posts:
                    post = db_session.query(Post).filter_by(url=p_item['url']).first()
                    if not post:
                        post = Post(url=p_item['url'], board_id=board.id)
                        db_session.add(post)
                    
                    post.title = p_item['subject']
                    post.writer = p_item['writer']
                    post.date = p_item['date']
                    
                    # Fetch content if missing
                    if not post.content:
                        post.content = self.get_post_content(p_item['url'])
                        
            except Exception as e:
                self.logger.error(f"Failed to sync posts for board {item['id']}: {e}")

        db_session.commit()
        db_session.commit()
        summary = f"Synced course {course_id}: {len(contents['announcements'])} announcements, {len(contents['assignments'])} assigns, {len(contents['files'])} files, {len(contents['boards'])} boards, {len(contents['vods'])} vods."
        self.logger.info(summary)
        return summary
