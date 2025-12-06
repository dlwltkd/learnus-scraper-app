# LearnUs Connect (런어스 커넥트)

**연세대학교 런어스(LearnUs) 모바일 최적화 프로젝트**

이 프로젝트는 연세대학교 학생들이 기존 웹 기반의 LearnUs를 모바일 환경에서 보다 직관적이고 편리하게 이용할 수 있도록 개발된 **비공식 학생 프로젝트**입니다. 
공식 앱이 제공하지 못하는 사용자 경험(UX) 개선과 강의 수강 편의성을 목표로 제작되었습니다.

---

##  주요 기능

*   **대시보드**: 할 일, 마감 임박 과제, 예정된 강의를 한눈에 확인
*   **동용상 강의 수강(베타)**: 모바일에 최적화된 동영상 플레이어 및 진도율 체크
*   **스마트 알림**: 과제 마감 및 출석 놓침 방지 알림
*   **AI 요약**: 강의 공지사항 및 내용을 AI가 요약하여 제공 (OpenAI 연동)

## 기술 스택 

*   **Frontend**: React Native (Expo), TypeScript
*   **Backend**: Python (FastAPI), Selenium/BeautifulSoup (Scraping)
*   **Database**: SQLite / PostgreSQL
*   **AI**: OpenAI GPT-4o-mini (강의 요약 기능)

## 주의사항

1.  이 앱은 **연세대학교 공식 앱이 아닙니다**. 학교 측의 공식적인 지원이나 승인을 받지 않았습니다.
2.  사용자의 **비밀번호는 별도로 저장되지 않으며**, SSO 로그인 후 발급된 세션 쿠키(Cookie)만을 사용하여 서비스를 제공합니다.
3.  이 프로젝트는 학습 및 포트폴리오 목적으로 공개되었으며, 실제 서비스 이용 시 발생하는 문제에 대해 책임지지 않습니다.

## 라이선스 (License)

이 프로젝트는 **MIT License**를 따릅니다.
누구나 자유롭게 코드를 열람, 수정, 배포할 수 있습니다. 단, 저작권 명시가 필요합니다.

```
MIT License

Copyright (c) 2024 Jisang Lee (이지상)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
