# LearnUs Connect (런어스 커넥트)

연세대학교 LearnUs를 모바일과 웹에서 이용하기 위한 비공식 학생 프로젝트입니다. Expo 앱, FastAPI API, PostgreSQL, 백그라운드 작업자와 명시적으로 실행하는 브라우저 SSO 도우미로 구성됩니다.

> 이 프로젝트는 연세대학교의 공식 앱이 아니며 학교의 지원이나 승인을 받지 않았습니다.

## 주요 기능

- 과제, 마감 일정, 예정 강의를 모아 보는 대시보드
- 모바일 동영상 강의 재생 및 출석 추적
- 강의 음성 텍스트 변환, AI 요약, 강의 내용 질의
- 과제와 출석 알림
- 공지사항, 게시판, 학습 자료 조회

## 구조

```text
learnus-app/          Expo / React Native 앱
api.py                FastAPI 진입점과 HTTP 라우트
auth_service.py       LearnUs 세션 확인, 웹 로그인 티켓과 브라우저 세션
database.py           SQLAlchemy 모델과 시작 시 마이그레이션
moodle_client.py      LearnUs 세션 및 HTML 파싱
worker.py             영속 작업 큐와 스케줄러 호스트
scheduler.py          동기화, 세션 점검, 알림, VOD 작업
ai_service.py         텍스트 변환 및 언어 모델 연동
browser-extension/    완료된 LearnUs SSO를 웹 로그인으로 연결하는 MV3 도우미
tests/                백엔드 pytest 테스트
scripts/              운영 및 유지보수 스크립트
docs/                 아키텍처, 배포, 운영 문서
```

전체 런타임 흐름과 각 디렉터리의 책임은 [아키텍처 문서](docs/architecture.md)에 정리되어 있습니다.

## 시작하기

백엔드 개발 환경:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-test.txt
pytest tests/ -v --tb=short
python api.py
```

`DATABASE_URL`을 설정하지 않으면 로컬 SQLite 데이터베이스를 사용합니다. AI 기능에는 `OPENAI_API_KEY`가 필요합니다.

Expo 앱:

```powershell
cd learnus-app
npm install
npx tsc --noEmit
npm run start
```

네이티브 앱은 기본적으로 `http://localhost:8000`에 연결하고 `EXPO_PUBLIC_API_URL`로 변경할 수 있습니다. 운영 웹은 host-only 세션 쿠키를 위해 항상 같은 출처의 `/api`를 사용합니다. 로컬 웹 개발에서만 `EXPO_PUBLIC_WEB_API_URL`로 별도 API를 지정할 수 있습니다. 네이티브 앱에는 Expo Go가 아닌 커스텀 개발 빌드가 필요합니다.

네이티브 로그인은 LearnUs WebView에서 확인한 세션을 `X-API-Token`으로 교환합니다. 웹 로그인은 [브라우저 SSO 도우미](browser-extension/README.md)가 만든 일회용 티켓을 완료한 뒤 host-only HttpOnly 쿠키만 사용하며, 네이티브 API 토큰을 브라우저 저장소에 넣지 않습니다. 웹 빌드와 현재 배포 제한은 [배포 문서](docs/deployment.md#web-build-and-sso-helper)를 참고하세요.

자세한 환경 구성과 변경 절차는 [CONTRIBUTING.md](CONTRIBUTING.md)를 따릅니다.

## 문서

| 문서 | 용도 |
|---|---|
| [문서 안내](docs/README.md) | 작업별 문서 찾기 |
| [아키텍처](docs/architecture.md) | 구성 요소, 소유 경계, 주요 데이터 흐름 |
| [기여 가이드](CONTRIBUTING.md) | 로컬 설정, 변경 절차, 검증 명령 |
| [배포](docs/deployment.md) | 서버, 웹, SSO 도우미와 모바일 앱 배포 |
| [모바일 앱 안내](learnus-app/README.md) | Expo 소스 구조와 개발 명령 |
| [Droplet 복구](docs/runbooks/droplet-recovery.md) | 새 서버 부트스트랩과 장애 복구 |
| [개인정보처리방침](docs/legal/privacy-policy.md) | 한국어 및 영어 개인정보 처리 고지 |
| [이용약관](docs/legal/terms-of-service.md) | 한국어 및 영어 서비스 약관 |

저장소의 기술 제약과 자동화 작업 규칙은 [AGENTS.md](AGENTS.md)에 있습니다.

## 보안

LearnUs 비밀번호는 저장하지 않습니다. 로그인 후 받은 세션 쿠키와 서비스 API 토큰은 자격 증명으로 취급해야 하며 로그나 이슈에 올리면 안 됩니다. 보안 문제를 공개 이슈로 등록하기 전에 저장소 관리자에게 비공개로 전달하세요.

## 라이선스

[MIT License](LICENSE), Copyright (c) 2024 Jisang Lee (이지상).
