import React from 'react';
import { useAuth } from './context/AuthContext';
import { useLabs } from './context/LabsContext';
import { useTheme, type ThemeMode } from './context/ThemeContext';
import { useToast } from './context/ToastContext';
import { useUser } from './context/UserContext';
import { APP_VERSION } from './constants/version';
import { PageHeading, WebIcon, useWebNavigation } from './components/web/WebUI';
import './components/web/account.css';

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
    { mode: 'light', label: '라이트' },
    { mode: 'dark', label: '다크' },
    { mode: 'system', label: '시스템' },
];

function AccountLink({
    title,
    description,
    onClick,
    href,
}: {
    title: string;
    description?: string;
    onClick?: () => void;
    href?: string;
}) {
    const content = (
        <>
            <span className="account-row-content">
                <strong>{title}</strong>
                {description && <span>{description}</span>}
            </span>
            <WebIcon
                name={href ? 'open-outline' : 'chevron-forward'}
                size={17}
            />
        </>
    );
    return href ? (
        <a className="account-link" href={href}>
            {content}
        </a>
    ) : (
        <button className="account-link" type="button" onClick={onClick}>
            {content}
        </button>
    );
}

export default function SettingsScreen() {
    const navigation = useWebNavigation();
    const { profile } = useUser();
    const { themeMode, setThemeMode } = useTheme();
    const { logout } = useAuth();
    const { labsUnlocked, autoWatchEnabled, brainEnabled } = useLabs();
    const { showConfirm } = useToast();

    const confirmLogout = () =>
        showConfirm(
            '로그아웃',
            '이 브라우저에서 로그아웃하시겠어요?',
            () => logout(),
            '로그아웃',
            '취소',
        );

    return (
        <div className="web-page account-page">
            <PageHeading
                title="설정"
                description="화면, 알림, 계정 설정을 한곳에서 관리하세요."
            />
            <div className="account-layout">
                <div className="account-main">
                    <section
                        className="web-panel account-section"
                        aria-labelledby="account-appearance-title"
                    >
                        <div className="account-section-heading">
                            <h2 id="account-appearance-title">화면 설정</h2>
                        </div>
                        <fieldset className="account-theme-fieldset">
                            <legend>테마</legend>
                            <div className="account-themes">
                                {THEME_OPTIONS.map(({ mode, label }) => (
                                    <label
                                        className={`account-theme-option${themeMode === mode ? ' is-selected' : ''}`}
                                        key={mode}
                                    >
                                        <input
                                            type="radio"
                                            name="theme"
                                            value={mode}
                                            checked={themeMode === mode}
                                            onChange={() => setThemeMode(mode)}
                                        />
                                        <span
                                            className={`account-theme-preview account-theme-preview-${mode}`}
                                            aria-hidden="true"
                                        >
                                            <span className="account-theme-mini-sidebar">
                                                <i />
                                                <i />
                                                <i />
                                            </span>
                                            <span className="account-theme-mini-main">
                                                <i />
                                                <span>
                                                    <i />
                                                    <i />
                                                </span>
                                                <i />
                                                <i />
                                            </span>
                                        </span>
                                        <span className="account-theme-label">
                                            {label}
                                            <span className="account-theme-radio">
                                                {themeMode === mode && (
                                                    <WebIcon
                                                        name="checkmark"
                                                        size={11}
                                                    />
                                                )}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <p className="account-theme-hint">
                                이 브라우저에 자동으로 저장돼요. 시스템을
                                선택하면 컴퓨터의 화면 설정을 따라가요.
                            </p>
                        </fieldset>
                        <div className="account-section-links">
                            <div className="account-static-row">
                                <span>표시 언어</span>
                                <span>한국어</span>
                            </div>
                        </div>
                    </section>

                    <section
                        className="web-panel account-section"
                        aria-labelledby="account-preferences-title"
                    >
                        <div className="account-section-heading">
                            <h2 id="account-preferences-title">
                                알림과 사용 설정
                            </h2>
                        </div>
                        <div className="account-section-links">
                            <AccountLink
                                title="알림 설정"
                                description="과제, 강의, 공지 알림 관리"
                                onClick={() =>
                                    navigation.navigate('NotificationSettings')
                                }
                            />
                            <AccountLink
                                title="주요 기능 둘러보기"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new Event('learnus:tour'),
                                    )
                                }
                            />
                            {labsUnlocked && (
                                <AccountLink
                                    title="실험실"
                                    description={`브레인 ${brainEnabled ? '켜짐' : '꺼짐'} · 자동 시청 메뉴 ${autoWatchEnabled ? '켜짐' : '꺼짐'}`}
                                    onClick={() => navigation.navigate('Labs')}
                                />
                            )}
                        </div>
                    </section>

                    <section
                        className="web-panel account-section"
                        aria-labelledby="account-support-title"
                    >
                        <div className="account-section-heading">
                            <h2 id="account-support-title">
                                도움말 및 서비스 정보
                            </h2>
                        </div>
                        <div className="account-support-grid">
                            <AccountLink
                                title="도움말"
                                description="사용 가이드 및 FAQ"
                                onClick={() => navigation.navigate('Help')}
                            />
                            <AccountLink
                                title="피드백 보내기"
                                href="mailto:dlwltkd@yonsei.ac.kr"
                            />
                            <AccountLink
                                title="이용약관"
                                onClick={() =>
                                    navigation.navigate('TermsOfService')
                                }
                            />
                            <AccountLink
                                title="개인정보 처리방침"
                                onClick={() =>
                                    navigation.navigate('PrivacyPolicy')
                                }
                            />
                        </div>
                    </section>
                </div>

                <aside className="account-sidebar" aria-label="내 계정">
                    <section className="web-panel account-profile">
                        <h2>{profile.name || '표시 이름을 설정하세요'}</h2>
                        <p>이 브라우저의 이름과 인사말</p>
                        <button
                            className="web-button account-profile-edit"
                            type="button"
                            onClick={() => navigation.navigate('MyInfo')}
                        >
                            표시 이름 수정
                        </button>
                    </section>
                    <section className="web-panel account-session">
                        <h2>로그인 관리</h2>
                        <p>
                            공용 컴퓨터에서 사용했다면
                            <br />
                            이용 후 로그아웃해주세요.
                        </p>
                        <button
                            className="web-button account-logout"
                            type="button"
                            onClick={confirmLogout}
                        >
                            로그아웃
                        </button>
                    </section>
                    <div className="account-version">
                        <span>LearnUs Connect</span>
                        <span>버전 {APP_VERSION}</span>
                    </div>
                </aside>
            </div>
        </div>
    );
}
