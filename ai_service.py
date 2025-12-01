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
        You are a smart academic assistant for a student. Analyze the following data for the course "{course_name}" and provide a concise status summary in Korean.

        Data:
        {json.dumps(data_context, ensure_ascii=False, default=str)}

        Instructions:
        1. **Correlate Information**: If an announcement is about a specific assignment or VOD, mention the announcement's key details next to that item.
        2. **Status Update**: Briefly state the current status of the class.
        3. **Action Items**: Clearly list what needs to be done (upcoming deadlines, unwatched VODs).
        4. **Format**: Use a clean, bulleted format.
        5. **Language**: Korean (Honorifics: 해요체).

        Output Format (Example):
        ## 📘 {course_name}
        **📢 주요 공지**
        - [공지 요약] (관련 과제/강의 언급)

        **📝 해야 할 일**
        - [과제/강의 명] (~12/05 마감) - [상태: 미완료/진행중]
        
        **💡 한줄 요약**
        [전체적인 상황 요약]
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
