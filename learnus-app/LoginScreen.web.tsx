import React from 'react';
import { useAuth } from './context/AuthContext';
import { WebIcon } from './components/web/WebUI';
import './components/web/account.css';

interface LoginScreenProps {
    onLoginSuccess: (token: string) => Promise<boolean>;
    autoLogout?: boolean;
    onAutoLogoutComplete?: () => void;
}

export default function LoginScreen(_props: LoginScreenProps) {
    const { webLoginError } = useAuth();
    const isPreview =
        __DEV__ &&
        typeof window !== 'undefined' &&
        window.location.pathname === '/preview/login';

    return (
        <main className="login-page">
            <section
                className="login-showcase"
                aria-labelledby="login-showcase-title"
            >
                <a
                    className="login-brand"
                    href={isPreview ? '/preview' : '/'}
                    aria-label="LearnUs Connect 홈"
                >
                    <span className="login-brand-mark">
                        <WebIcon name="layers" size={22} />
                    </span>
                    <span>
                        LearnUs
                        <span className="login-brand-light"> Connect</span>
                    </span>
                </a>

                <div className="login-showcase-content">
                    <span className="login-eyebrow">
                        YOUR SEMESTER, CONNECTED
                    </span>
                    <h1 id="login-showcase-title">
                        수업에 필요한 모든 것,
                        <br />
                        한눈에.
                    </h1>
                    <p className="login-showcase-description">
                        강의부터 과제, 놓치기 쉬운 공지까지.
                        <br />
                        한곳에서 정리하고, 중요한 일에 집중하세요.
                    </p>

                    <figure className="login-preview">
                        <div
                            className="login-preview-window"
                            aria-hidden="true"
                        >
                            <div className="login-preview-sidebar">
                                <span className="login-preview-logo">
                                    <WebIcon name="layers" size={18} />
                                </span>
                                <span className="login-preview-nav-active">
                                    <WebIcon name="grid-outline" size={17} />
                                </span>
                                <WebIcon name="play-circle-outline" size={18} />
                                <WebIcon name="albums-outline" size={18} />
                                <span className="login-preview-sidebar-end">
                                    <WebIcon
                                        name="settings-outline"
                                        size={17}
                                    />
                                </span>
                            </div>
                            <div className="login-preview-content">
                                <div className="login-preview-topline">
                                    <span>나의 학습 공간</span>
                                    <WebIcon
                                        name="notifications-outline"
                                        size={15}
                                    />
                                </div>
                                <strong className="login-preview-title">
                                    오늘도 한 걸음 더.
                                </strong>
                                <span className="login-preview-subtitle">
                                    나의 수업과 할 일을 한눈에 확인하세요.
                                </span>
                                <div className="login-preview-courses">
                                    <div className="login-preview-course">
                                        <span className="login-preview-course-icon">
                                            <WebIcon
                                                name="book-outline"
                                                size={18}
                                            />
                                        </span>
                                        <strong>전공 수업</strong>
                                        <span>강의 · 과제 · 자료</span>
                                        <div className="login-preview-progress">
                                            <i />
                                        </div>
                                    </div>
                                    <div className="login-preview-course login-preview-course-alt">
                                        <span className="login-preview-course-icon">
                                            <WebIcon
                                                name="planet-outline"
                                                size={18}
                                            />
                                        </span>
                                        <strong>교양 수업</strong>
                                        <span>강의 · 과제 · 자료</span>
                                        <div className="login-preview-progress">
                                            <i />
                                        </div>
                                    </div>
                                </div>
                                <div className="login-preview-list-heading">
                                    오늘의 할 일 <span>모두 보기 ↗</span>
                                </div>
                                <div className="login-preview-task">
                                    <span className="login-preview-check" />
                                    <span>강의 이어보기</span>
                                    <span className="login-preview-tag">
                                        강의
                                    </span>
                                </div>
                                <div className="login-preview-task">
                                    <span className="login-preview-check" />
                                    <span>이번 주 과제 확인하기</span>
                                    <span className="login-preview-tag login-preview-tag-warm">
                                        과제
                                    </span>
                                </div>
                                <div className="login-preview-task">
                                    <span className="login-preview-check login-preview-check-done">
                                        <WebIcon name="checkmark" size={10} />
                                    </span>
                                    <span>새로운 공지 읽기</span>
                                    <span className="login-preview-tag">
                                        공지
                                    </span>
                                </div>
                            </div>
                        </div>
                        <figcaption>
                            LearnUs Connect 미리보기 · 예시 화면
                        </figcaption>
                    </figure>
                </div>

                <div className="login-showcase-footer">
                    <span>조금 더 여유로운 대학 생활.</span>
                    <span>LEARNUS CONNECT</span>
                </div>
            </section>

            <section
                className="login-connect"
                aria-labelledby="login-connect-title"
            >
                <div className="login-connect-top">
                    <span className="login-browser-label">
                        <WebIcon name="desktop-outline" size={16} /> WEB
                        WORKSPACE
                    </span>
                    <a href="mailto:dlwltkd@yonsei.ac.kr">
                        도움이 필요하세요?{' '}
                        <WebIcon name="open-outline" size={15} />
                    </a>
                </div>
                <div className="login-connect-content">
                    {isPreview && (
                        <a className="web-button ghost" href="/preview">
                            <WebIcon name="arrow-back" size={16} />
                            워크스페이스 미리보기로 돌아가기
                        </a>
                    )}
                    <span className="login-connect-symbol">
                        <WebIcon name="link-outline" size={28} />
                    </span>
                    <span className="login-form-eyebrow">시작하기</span>
                    <h2 id="login-connect-title">
                        반가워요.
                        <br />
                        오늘의 수업을 연결해요.
                    </h2>
                    <p className="login-connect-description">
                        연세대학교 LearnUs 계정으로
                        <br className="login-desktop-break" /> 나만의 학습
                        공간을 시작하세요.
                    </p>

                    <a
                        className="web-button primary login-sso-button"
                        href="https://ys.learnus.org/login/index.php"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        LearnUs SSO 열기{' '}
                        <WebIcon name="arrow-forward" size={19} />
                    </a>
                    <span className="login-new-tab-note">
                        Chrome 또는 Edge에서 확장 프로그램과 함께 사용해요.
                    </span>

                    <div className="login-steps-heading">
                        <span>처음 연결하시나요?</span>
                        <span>간단한 두 단계</span>
                    </div>
                    <ol className="login-steps">
                        <li>
                            <span className="login-step-number">1</span>
                            <div>
                                <strong>LearnUs에 로그인하기</strong>
                                <p>
                                    위 버튼을 눌러 연세 SSO 로그인을 완료하세요.
                                    이미 로그인했다면 2단계로 바로 진행하세요.
                                </p>
                            </div>
                        </li>
                        <li>
                            <span className="login-step-number">2</span>
                            <div>
                                <strong>이 브라우저 연결하기</strong>
                                <p>
                                    같은 브라우저에서 LearnUs Connect 확장 프로그램을 열고
                                    <br />
                                    <b>“이 브라우저 연결”</b>을 누르면 준비 끝.
                                </p>
                            </div>
                        </li>
                    </ol>

                    {webLoginError && (
                        <div className="login-error" role="alert">
                            <WebIcon name="alert-circle-outline" size={19} />
                            <div>
                                <span>{webLoginError}</span>
                                <button
                                    type="button"
                                    className="web-button small"
                                    onClick={() => window.location.reload()}
                                >
                                    연결 상태 다시 확인
                                </button>
                            </div>
                        </div>
                    )}

                    <details className="login-extension-help">
                        <summary>
                            <WebIcon
                                name="extension-puzzle-outline"
                                size={17}
                            />
                            <span>확장 프로그램 설치 및 연결 도움말</span>
                            <WebIcon name="chevron-down" size={15} />
                        </summary>
                        <p>
                            Chrome 또는 Edge의 주소창 옆 확장 프로그램 메뉴에서
                            LearnUs Connect를 열어주세요. 자주 사용한다면
                            툴바에 고정해두세요. SSO와 연결은 같은 브라우저에서
                            진행해야 하며, 시크릿 창은 지원하지 않아요.
                        </p>
                        <a href="mailto:dlwltkd@yonsei.ac.kr">
                            설치 및 연결 문의{' '}
                            <WebIcon name="arrow-forward" size={14} />
                        </a>
                        <p>
                            연결을 누르면 LearnUs 로그인 정보(쿠키)가 서버에
                            전달·보관되어 수업 동기화에 사용돼요.
                        </p>
                        <a
                            href="https://github.com/dlwltkd/learnus-scraper-app/blob/main/docs/legal/privacy-policy.md"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            개인정보 처리방침
                            <WebIcon name="open-outline" size={14} />
                        </a>
                    </details>
                </div>
                <div className="login-connect-footer">
                    <WebIcon name="lock-closed-outline" size={14} />
                    <p>
                        비밀번호는 LearnUs에서만 입력해요.
                        <br />
                        사용을 마친 공용 컴퓨터에서는 로그아웃해주세요.
                    </p>
                </div>
            </section>
        </main>
    );
}
