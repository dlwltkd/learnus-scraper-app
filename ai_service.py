import os
from openai import OpenAI
from dotenv import load_dotenv
import json
from datetime import datetime

load_dotenv()

class AIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def generate_course_summary(self, course_name, announcements, assignments, vods):
        """
        Generates a structured JSON summary for a course using OpenAI.
        Returns structured data for better frontend rendering.
        """

        # Prepare data for the prompt
        data_context = {
            "course_name": course_name,
            "current_date": datetime.now().strftime("%Y-%m-%d"),
            "announcements": [
                {"title": a.title, "content": (a.content[:500] if a.content else ""), "date": str(a.date)}
                for a in announcements[:5]
            ],
            "assignments": [
                {"title": a.title, "due_date": str(a.due_date) if a.due_date else None, "is_completed": a.is_completed}
                for a in assignments
            ],
            "vods": [
                {"title": v.title, "start_date": str(v.start_date), "end_date": str(v.end_date), "is_completed": v.is_completed}
                for v in vods
            ]
        }

        prompt = f"""You are an AI academic assistant. Analyze the course data and return a JSON response.

Course: "{course_name}"
Current Date: {data_context['current_date']}

Data:
{json.dumps(data_context, ensure_ascii=False, default=str)}

Return ONLY valid JSON in this exact structure (no markdown, no code blocks):
{{
    "status": "calm" | "busy" | "urgent",
    "status_message": "한줄 상태 메시지 (예: 여유로운 한 주예요!)",
    "urgent": {{
        "count": number,
        "items": [
            {{"title": "항목명", "due": "D-1", "type": "assignment" | "vod"}}
        ]
    }},
    "upcoming": {{
        "count": number,
        "items": [
            {{"title": "항목명", "due": "D-5", "type": "assignment" | "vod"}}
        ]
    }},
    "announcement": {{
        "has_new": boolean,
        "summary": "최근 공지 요약 (1-2문장)" | null
    }},
    "insight": "학생에게 도움이 될 조언 한마디 (격려/팁)"
}}

Rules:
- "status": "urgent" if items due within 2 days, "busy" if within 5 days, "calm" otherwise
- "due" format: "D-N" for N days remaining, "오늘" for today, "내일" for tomorrow
- Maximum 3 items in urgent.items and upcoming.items
- All text in Korean (해요체)
- Keep summaries concise (under 50 chars each)
- Be encouraging but realistic
- Only include incomplete items (is_completed: false)"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a JSON-only response bot. Return only valid JSON, no explanations."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.3
            )

            result = response.choices[0].message.content.strip()
            # Clean potential markdown code blocks
            if result.startswith("```"):
                result = result.split("```")[1]
                if result.startswith("json"):
                    result = result[4:]
            result = result.strip()

            # Validate JSON
            parsed = json.loads(result)
            return parsed

        except json.JSONDecodeError as e:
            print(f"JSON Parse Error for {course_name}: {e}")
            return self._fallback_summary(course_name)
        except Exception as e:
            print(f"Error generating summary for {course_name}: {e}")
            return self._fallback_summary(course_name)

    def _fallback_summary(self, course_name):
        """Return a safe fallback structure if AI fails"""
        return {
            "status": "calm",
            "status_message": "요약을 불러올 수 없어요",
            "urgent": {"count": 0, "items": []},
            "upcoming": {"count": 0, "items": []},
            "announcement": {"has_new": False, "summary": None},
            "insight": "데이터를 새로고침해 주세요."
        }

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
