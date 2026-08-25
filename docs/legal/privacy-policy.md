# 개인정보처리방침 (Privacy Policy)

**최종 업데이트**: 2026-08-25

LearnUs Connect(이하 “서비스”)는 연세대학교 LearnUs 정보를 사용자가 한곳에서 확인하고 선택한 AI·알림 기능을 이용할 수 있도록 제공되는 독립 서비스입니다. 이 방침은 모바일 앱, 웹 서비스, LearnUs Connect 브라우저 확장 프로그램에 적용됩니다.

## 1. 처리하는 정보와 수집 방법

서비스는 기능 제공을 위해 다음 정보를 처리합니다.

- **LearnUs 계정 및 세션**: LearnUs 사용자 ID, 서비스 내부 사용자명, LearnUs 인증 쿠키. 비밀번호는 저장하지 않습니다.
- **학습 정보**: 강좌, 과제, 강의 영상 메타데이터, 파일, 게시판과 공지, 진도 및 완료 상태.
- **사용자가 생성하거나 요청한 정보**: 강의 전사, 요약, AI 대화, 플래시카드, 강좌 Brain 결과와 사용량 기록.
- **알림 정보**: Expo 푸시 토큰, 기기 이름, 알림 환경설정과 알림 내역.
- **진단 정보**: 사용자가 직접 제출한 로그인 진단 보고서의 기기 정보와 이벤트 로그. 쿠키·비밀번호 값은 진단 로그에 기록하지 않도록 설계되어 있습니다.

모바일 앱은 사용자가 LearnUs WebView에서 SSO를 완료한 뒤 세션 쿠키를 전송합니다. 브라우저 확장 프로그램은 사용자가 **이 브라우저 연결**을 명시적으로 누른 경우에만 `ys.learnus.org`에 적용되는 쿠키(일부 HttpOnly 쿠키 포함)를 읽어 LearnUs Connect 서버로 전송합니다. 확장 프로그램은 사용자명이나 비밀번호를 읽지 않으며, 쿠키·로그인 티켓·서비스 세션을 브라우저 확장 저장소에 보관하지 않습니다.

## 2. 처리 목적

- LearnUs 세션 확인과 사용자 식별
- 강좌·과제·강의·공지 동기화와 대시보드 제공
- 사용자가 선택한 전사, 요약, 대화, 플래시카드 및 Course Brain 기능 제공
- 알림 전송과 알림 내역 관리
- 사용량 제한, 보안, 장애 진단과 서비스 운영

## 3. 외부 서비스 이용

서비스 기능에 따라 다음 외부 서비스가 정보를 처리할 수 있습니다.

- **연세대학교 LearnUs**: 사용자가 설정한 세션으로 강좌와 학습 정보를 조회합니다.
- **OpenAI**: 사용자가 AI 또는 전사 기능을 실행한 경우, 해당 기능에 필요한 강의 음성·텍스트·프롬프트가 처리될 수 있습니다.
- **Expo 푸시 서비스**: 사용자가 알림을 허용한 경우, 푸시 토큰과 알림 제목·본문·연결 데이터가 전송될 수 있습니다.
- **서버 호스팅 사업자**: 데이터베이스와 파일이 서비스 서버에 저장·처리됩니다.

법령에 따른 요구가 있는 경우에도 적용되는 절차와 범위 안에서만 정보를 제공할 수 있습니다.

## 4. 보관과 삭제

- LearnUs 세션, 동기화된 학습 정보, 전사, AI 결과, 플래시카드와 알림 내역은 서비스 기능 제공 및 계정 데이터 삭제 요청 처리 시까지 서버에 보관될 수 있습니다.
- 브라우저 로그인 티켓은 기본 90초 후 사용할 수 없으며 한 번만 사용할 수 있습니다. 브라우저 서비스 세션은 기본 7일 후 만료되거나 로그아웃 시 해당 세션만 폐기됩니다.
- 앱 삭제나 브라우저 확장 프로그램 삭제는 해당 기기의 로컬 데이터만 제거하며 서버 데이터를 자동으로 삭제하지 않습니다.
- 계정 데이터 삭제를 원하면 아래 연락처로 요청할 수 있습니다. 법적·보안상 보관 의무가 없는 정보는 확인 후 삭제합니다.

현재 LearnUs 인증 쿠키는 한 사용자 계정에 하나의 서버 세션으로 보관됩니다. 웹에서 다시 연결하면 모바일 또는 백그라운드 동기화가 사용하는 LearnUs 세션이 갱신될 수 있습니다.

## 5. 보호 조치

- 비밀번호를 저장하거나 서비스 인증 토큰·쿠키 값을 로그에 기록하지 않습니다.
- 웹 로그인 티켓과 웹 세션의 원문은 데이터베이스에 저장하지 않고 SHA-256 해시만 저장합니다.
- 웹 서비스 세션은 운영 환경에서 host-only, Secure, HttpOnly, SameSite 쿠키로 전달됩니다.
- 웹에서 상태를 변경하는 요청은 허용된 웹 출처의 요청인지 확인합니다.
- 사용자별 데이터 조회는 서버에서 소유권을 확인합니다.

## 6. 이용자의 선택과 권리

사용자는 알림과 실험 기능을 끌 수 있고, 개별 브라우저에서 로그아웃할 수 있습니다. 자신의 서버 데이터 열람·정정·삭제 또는 처리 관련 문의는 아래 연락처로 요청할 수 있습니다. 본인 확인이 필요할 수 있습니다.

## 7. 아동의 개인정보

서비스는 연세대학교 LearnUs 사용 권한이 있는 이용자를 대상으로 하며 아동을 대상으로 설계되지 않았습니다. 보호자가 아동의 정보가 처리되었다고 판단하는 경우 아래 연락처로 문의할 수 있습니다.

## 8. 문의

- **이메일**: dlwltkd@yonsei.ac.kr
- **개발자**: 이지상

이 방침의 중요한 내용이 바뀌면 최종 업데이트 날짜와 함께 공지합니다.

---

## English

**Last updated**: 2026-08-25

LearnUs Connect (the “Service”) is an independent service for viewing Yonsei LearnUs information and using optional AI and notification features. This policy applies to the mobile app, web service, and LearnUs Connect browser extension.

## 1. Information processed and how it is collected

The Service processes the following information when needed to provide its features:

- **LearnUs account and session data**: LearnUs user ID, internal service username, and LearnUs authentication cookies. Passwords are not stored.
- **Learning data**: courses, assignments, lecture metadata, files, boards and announcements, progress, and completion status.
- **User-created or requested data**: lecture transcripts, summaries, AI chats, flashcards, Course Brain results, and usage records.
- **Notification data**: Expo push token, device name, notification preferences, and notification history.
- **Diagnostic data**: device information and event logs included in a login report that the user explicitly submits. The system is designed not to record cookie or password values in diagnostic logs.

On mobile, the user completes SSO in a LearnUs WebView and the app submits the resulting session cookies. The browser extension reads cookies applicable to `ys.learnus.org`, including some HttpOnly cookies, only after the user explicitly selects **Connect this browser**, and sends them to the LearnUs Connect server. The extension does not read usernames or passwords and does not retain cookies, login tickets, or service sessions in extension storage.

## 2. Purposes

- Validate a LearnUs session and identify the user
- Synchronize courses, assignments, lectures, and announcements
- Provide user-requested transcription, summary, chat, flashcard, and Course Brain features
- Deliver notifications and maintain notification history
- Enforce usage limits, protect the Service, diagnose failures, and operate the system

## 3. External services

Depending on the feature used, information may be processed by:

- **Yonsei LearnUs**, which is accessed using the session established by the user.
- **OpenAI**, when the user invokes an AI or transcription feature; the required lecture audio, text, and prompts may be processed.
- **Expo push services**, when notifications are enabled; the push token and notification content may be transmitted.
- **The server hosting provider**, which processes the Service database and stored files.

Information may also be disclosed when required by law, limited to the applicable process and scope.

## 4. Retention and deletion

- LearnUs sessions, synchronized learning data, transcripts, AI results, flashcards, and notification history may remain on the server while needed to provide the Service and until an account-data deletion request is completed.
- Browser login tickets are unusable after 90 seconds by default and can be used only once. Browser sessions expire after seven days by default or are revoked individually on logout.
- Removing the app or extension deletes local data on that device; it does not automatically delete server data.
- To request deletion of account data, contact the address below. Information without a legal or security retention requirement will be deleted after verification.

The Service currently keeps one canonical LearnUs cookie session per user account. Reconnecting on the web may therefore refresh the LearnUs session used by mobile or background synchronization.

## 5. Safeguards

- Passwords are not stored, and credential values are not intentionally written to logs.
- Only SHA-256 hashes of web login tickets and web sessions are stored in the database.
- In production, the web session uses a host-only, Secure, HttpOnly, SameSite cookie.
- Browser requests that change state must come from an allowed web origin.
- Server-side ownership checks scope user data.

## 6. User choices and rights

Users can disable notifications and experimental features and can sign out an individual browser. Requests to access, correct, or delete server data, and other privacy questions, can be sent to the contact below. Identity verification may be required.

## 7. Children

The Service is intended for people authorized to use Yonsei LearnUs and is not designed for children. A parent or guardian who believes a child’s data has been processed may contact us.

## 8. Contact

- **Email**: dlwltkd@yonsei.ac.kr
- **Developer**: 이지상

Material changes will be announced with an updated date.
