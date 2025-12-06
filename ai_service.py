import os
from openai import OpenAI
from dotenv import load_dotenv
import json

load_dotenv()

class AIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def generate_course_summary(self, course_name, announcements, assignments, vods):
        """
        Generates a structured summary for a course using OpenAI.
        """
        
        # Prepare data for the prompt
        data_context = {
            "course_name": course_name,
            "announcements": [
                {"title": a.title, "content": a.content, "date": a.date} 
                for a in announcements
            ],
            "assignments": [
                {"title": a.title, "due_date": a.due_date, "is_completed": a.is_completed}
                for a in assignments
            ],
            "vods": [
                {"title": v.title, "start_date": v.start_date, "end_date": v.end_date, "is_completed": v.is_completed}
                for v in vods
            ]
        }

        prompt = f"""
        You are a proactive academic coach helping a student stay on top of their coursework. 
        Analyze the data for the course "{course_name}" and provide a structured status update in Korean.

        Data:
        {json.dumps(data_context, ensure_ascii=False, default=str)}

        **Instructions:**
        1. **Analyze Priorities**: Identify items due within 3 days (Urgent) and 7 days (Upcoming).
        2. **Format**: Use the following structure exactly. Do not use Markdown headers (##). Use bolding for categories. 
        
        **Structure:**
        
        **긴급**
        - List assignments/VODs due within 3 days. 
        - If none, write "없음".

        **예정**
        - List assignments/VODs due within 7 days.
        - If none, write "없음".

        **공지**
        - Summarize only the most recent/critical announcement.

        **한줄 요약**
        - ONE sentence summary of the overall status (e.g., "이번 주는 여유롭네요!" or "과제가 많으니 서둘러야 해요!").

        **Tone**: Professional, concise, and encouraging (Korean, Honorifics: 해요체).
        """

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful academic assistant."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generating summary for {course_name}: {e}")
            return "요약을 생성하는 중 오류가 발생했습니다."
