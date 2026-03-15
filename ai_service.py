import os
import subprocess
import tempfile
from openai import OpenAI
from dotenv import load_dotenv
import json
from datetime import datetime, date

load_dotenv()

def _days_remaining(due_date_str):
    """Returns days until due date (negative = past). None if no due date."""
    if not due_date_str or due_date_str == 'None':
        return None
    try:
        due = datetime.fromisoformat(str(due_date_str).strip()).date()
        return (due - date.today()).days
    except Exception:
        return None

def _due_label(days):
    """Convert days remaining to a display label."""
    if days is None:
        return None
    if days < 0:
        return f"D+{abs(days)}"
    if days == 0:
        return "오늘"
    if days == 1:
        return "내일"
    return f"D-{days}"

class AIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def generate_course_summary(self, course_name, announcements, assignments, vods):
        """
        Generates a structured JSON summary for a course using OpenAI.
        Date math is pre-computed in Python — AI only writes text, not dates.
        """
        now = date.today()

        # Pre-filter: only INCOMPLETE items with a future (or today) due date
        def assignment_days(a):
            d = _days_remaining(a.due_date)
            return d

        urgent_items = []   # due today or tomorrow (days 0 or 1)
        upcoming_items = [] # due in 2–7 days

        for a in assignments:
            if a.is_completed:
                continue
            days = assignment_days(a)
            if days is None or days < 0:
                continue  # no due date or already past — skip
            label = _due_label(days)
            entry = {"title": a.title, "due": label, "type": "assignment"}
            if days <= 1:
                urgent_items.append(entry)
            elif days <= 7:
                upcoming_items.append(entry)

        for v in vods:
            if v.is_completed:
                continue
            days = _days_remaining(v.end_date)
            if days is None or days < 0:
                continue
            label = _due_label(days)
            entry = {"title": v.title, "due": label, "type": "vod"}
            if days <= 1:
                urgent_items.append(entry)
            elif days <= 7:
                upcoming_items.append(entry)

        # Sort by urgency (lowest days first) and cap at 3
        urgent_items = urgent_items[:3]
        upcoming_items = upcoming_items[:3]

        # Determine status
        if urgent_items:
            status = "urgent"
        elif upcoming_items:
            status = "busy"
        else:
            status = "calm"

        # Only ask the AI for text content
        recent_announcements = [
            {"title": a.title, "content": (a.content[:300] if a.content else ""), "date": str(a.date)}
            for a in announcements[:3]
        ]

        prompt = f"""You are a Korean academic assistant. Based on this course data, write the text fields only.

Course: "{course_name}"
Status: "{status}"
Urgent items (due today/tomorrow): {json.dumps(urgent_items, ensure_ascii=False)}
Upcoming items (due in 2-7 days): {json.dumps(upcoming_items, ensure_ascii=False)}
Recent announcements: {json.dumps(recent_announcements, ensure_ascii=False)}

Return ONLY valid JSON (no markdown):
{{
    "status_message": "한줄 상태 메시지",
    "announcement": {{
        "has_new": boolean,
        "summary": "최근 공지 요약 (1-2문장)" | null
    }},
    "insight": "학생에게 도움이 될 조언 한마디 (격려/팁)"
}}

Rules:
- status_message examples: urgent→"마감이 코앞이에요!", busy→"이번 주 할 일이 있어요.", calm→"여유로운 한 주예요!"
- announcement.has_new: true only if announcements list is non-empty
- All text in Korean (해요체), under 50 chars each"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a JSON-only response bot. Return only valid JSON, no explanations."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.3
            )

            result = response.choices[0].message.content.strip()
            if result.startswith("```"):
                result = result.split("```")[1]
                if result.startswith("json"):
                    result = result[4:]
            result = result.strip()

            ai_parts = json.loads(result)

            return {
                "status": status,
                "status_message": ai_parts.get("status_message", ""),
                "urgent": {"count": len(urgent_items), "items": urgent_items},
                "upcoming": {"count": len(upcoming_items), "items": upcoming_items},
                "announcement": ai_parts.get("announcement", {"has_new": False, "summary": None}),
                "insight": ai_parts.get("insight", "")
            }

        except json.JSONDecodeError as e:
            print(f"JSON Parse Error for {course_name}: {e}")
            return self._fallback_summary(course_name, status, urgent_items, upcoming_items)
        except Exception as e:
            print(f"Error generating summary for {course_name}: {e}")
            return self._fallback_summary(course_name, status, urgent_items, upcoming_items)

    def _fallback_summary(self, course_name, status="calm", urgent_items=None, upcoming_items=None):
        """Return a safe fallback structure if AI fails — still uses pre-computed items"""
        urgent_items = urgent_items or []
        upcoming_items = upcoming_items or []
        return {
            "status": status,
            "status_message": "요약을 불러올 수 없어요",
            "urgent": {"count": len(urgent_items), "items": urgent_items},
            "upcoming": {"count": len(upcoming_items), "items": upcoming_items},
            "announcement": {"has_new": False, "summary": None},
            "insight": "데이터를 새로고침해 주세요."
        }

    def transcribe_vod(self, m3u8_url: str) -> str:
        """
        Downloads audio from an HLS stream via ffmpeg and transcribes it with Whisper.
        Returns the transcript text, or raises on failure.
        """
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            # Extract audio only — much faster and cheaper than full video
            result = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", m3u8_url,
                    "-vn",                  # no video
                    "-acodec", "libmp3lame",
                    "-q:a", "4",
                    tmp_path
                ],
                capture_output=True,
                timeout=600  # 10 min max
            )
            if result.returncode != 0:
                raise RuntimeError(f"ffmpeg failed: {result.stderr.decode()[:500]}")

            with open(tmp_path, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            return response
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def summarize_text(self, text: str, max_length: int = 150) -> str:
        """
        Summarizes a long text into a concise notification body (approx max_length chars).
        """
        if not text or len(text) < 50:
            return text[:max_length]

        prompt = f"""
        Summarize the following academic notice into a very concise single sentence (Korean, Polite/Honorific).
        It must be suitable for a push notification body (max {max_length} chars).
        Focus on the core action/info (e.g. "Exam schedule changed to...", "New assignment posted...").
        
        Text:
        {text[:2000]}
        """

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a concise notification summarizer."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=100,
                temperature=0.5
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Error summarizing text: {e}")
            return text[:max_length]
