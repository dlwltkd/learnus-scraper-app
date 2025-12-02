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
        You are a smart academic assistant. Analyze the data for the course "{course_name}" and provide a brief, helpful status update in Korean.

        Data:
        {json.dumps(data_context, ensure_ascii=False, default=str)}

        Instructions:
        0. You must take in all the data for the class, organize it in the way best for the user to understand
         and provide a detailed status update in an organized manner.
        Summarize Announcements, Assignments, and VODs(동영상 강의) in a concise but detailed manner. 
        1. **Summary**: 
        2. **Key Items**: List the most critical 1-3 items (deadlines within 7 days, unwatched VODs).
        3. **Tone**: Encouraging and professional (Korean, Honorifics: 해요체).
        4. **Format**: Keep it very concise. Do not use Markdown headers like ##. Use bolding for emphasis.


        
        """

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful academic assistant."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generating summary for {course_name}: {e}")
            return "요약을 생성하는 중 오류가 발생했습니다."
