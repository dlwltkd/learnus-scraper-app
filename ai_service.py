import os
import subprocess
import tempfile
from openai import OpenAI
from dotenv import load_dotenv
import json
import logging
from datetime import datetime, date

load_dotenv()

logger = logging.getLogger(__name__)


def _extract_usage(response) -> dict:
    """Extract token usage from an OpenAI response."""
    if hasattr(response, 'usage') and response.usage:
        return {
            "prompt_tokens": response.usage.prompt_tokens or 0,
            "completion_tokens": response.usage.completion_tokens or 0,
            "total_tokens": response.usage.total_tokens or 0,
        }
    return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

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

            usage = _extract_usage(response)
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
                "insight": ai_parts.get("insight", ""),
                "_usage": {"model": "gpt-4o-mini", **usage},
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
                    "-ac", "1",             # mono
                    "-ab", "32k",           # 32kbps — ~14MB/hr, well under Whisper's 25MB limit
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
            return response, {"model": "whisper-1", "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def summarize_transcript(self, transcript: str, course_name: str) -> str:
        """
        Summarizes a lecture transcript as natural text.
        Returns a plain string: one sentence about the course, then a short paragraph about this lecture.
        """
        prompt = f"""You are a Korean academic assistant. Based on this lecture transcript from the course "{course_name}", write a short summary in Korean (해요체).

Format (plain text, no markdown, no JSON):
Line 1: One title about the lecture. (A few words)
Line 2: (blank line)
Line 3+: 2-3 sentences describing what was specifically covered in this lecture.

Keep it concise and natural. Focus on content, not on the fact that it's a lecture.

Transcript:
{transcript[:12000]}"""

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a concise academic summarizer. Write in Korean (해요체). Plain text only, no markdown."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
            temperature=0.4
        )
        usage = _extract_usage(response)
        return response.choices[0].message.content.strip(), {"model": "gpt-4o-mini", **usage}

    def chat_about_transcript(self, transcript: str, course_name: str, lecture_title: str, messages: list) -> str:
        """
        Multi-turn chat about a lecture transcript.
        messages: list of {role: "user"|"assistant", content: str}
        Returns the assistant's reply.
        """
        # Truncate transcript to fit within context window
        truncated = transcript[:80000]

        system_prompt = f"""You are a Korean academic assistant helping a student understand a lecture.
You answer based on the lecture transcript provided below. You can:
- Answer questions about the lecture content
- Generate study notes, flashcards, or summaries
- Explain concepts mentioned in the lecture
- Help with exam preparation

Always respond in Korean (해요체). Be concise and helpful.
If asked about something not in the transcript, say so honestly.

Course: {course_name}
Lecture: {lecture_title}

=== Transcript ===
{truncated}
=== End Transcript ==="""

        api_messages = [{"role": "system", "content": system_prompt}]
        api_messages.extend(messages)

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=api_messages,
                max_tokens=1000,
                temperature=0.5,
            )
            usage = _extract_usage(response)
            return response.choices[0].message.content.strip(), {"model": "gpt-4o-mini", **usage}
        except Exception as e:
            raise RuntimeError(f"AI chat failed: {e}")

    def chat_about_transcript_stream(self, transcript: str, course_name: str, lecture_title: str, messages: list):
        """Streaming version of chat_about_transcript. Yields token strings."""
        truncated = transcript[:80000]

        system_prompt = f"""You are a Korean academic assistant helping a student understand a lecture.
You answer based on the lecture transcript provided below. You can:
- Answer questions about the lecture content
- Generate study notes, flashcards, or summaries
- Explain concepts mentioned in the lecture
- Help with exam preparation

Always respond in Korean (해요체). Be concise and helpful.
If asked about something not in the transcript, say so honestly.

Course: {course_name}
Lecture: {lecture_title}

=== Transcript ===
{truncated}
=== End Transcript ==="""

        api_messages = [{"role": "system", "content": system_prompt}]
        api_messages.extend(messages)

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=api_messages,
            max_tokens=1000,
            temperature=0.5,
            stream=True,
            stream_options={"include_usage": True},
        )
        usage_info = {"model": "gpt-4o-mini", "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        for chunk in response:
            if chunk.usage:
                usage_info = {"model": "gpt-4o-mini", **_extract_usage(chunk)}
            if chunk.choices and chunk.choices[0].delta.content:
                yield "token", chunk.choices[0].delta.content
        yield "usage", usage_info

    def generate_flashcards(self, transcript: str, course_name: str, lecture_title: str, count: int = 10):
        """
        Generates structured flashcards from a lecture transcript.
        Returns (cards_list, usage_dict) where cards_list is [{front, back}, ...].
        """
        count = max(1, min(count, 20))
        truncated = transcript[:12000]

        prompt = f"""Based on this lecture transcript, generate exactly {count} flashcards for study purposes.

Course: {course_name}
Lecture: {lecture_title}

Rules:
- "front": a clear, specific question about a key concept from the lecture
- "back": a concise but complete answer (1-3 sentences)
- All text in Korean (해요체)
- Focus on definitions, key concepts, important details, and relationships
- Make questions specific enough to test understanding, not just recall

Transcript:
{truncated}"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a flashcard generator. Return only valid JSON with a 'cards' array."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.4,
                response_format={"type": "json_object"},
            )
            usage = _extract_usage(response)
            result = response.choices[0].message.content.strip()
            parsed = json.loads(result)
            cards = parsed.get("cards", [])
            # Validate structure
            cards = [{"front": c["front"], "back": c["back"]} for c in cards if "front" in c and "back" in c]
            return cards, {"model": "gpt-4o-mini", **usage}
        except (json.JSONDecodeError, KeyError) as e:
            raise RuntimeError(f"Failed to parse flashcard response: {e}")
        except Exception as e:
            raise RuntimeError(f"Flashcard generation failed: {e}")

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
            usage = _extract_usage(response)
            logger.info(f"summarize_text usage: {usage}")
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Error summarizing text: {e}")
            return text[:max_length]
