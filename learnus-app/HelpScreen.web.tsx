import React, { useEffect, useRef, useState } from 'react';
import { useLabs } from './context/LabsContext';
import { useToast } from './context/ToastContext';
import { APP_VERSION } from './constants/version';
import { isDemoMode } from './services/demoMode';
import { PageHeading, useWebNavigation } from './components/web/WebUI';
import './components/web/preferences.css';

const QUESTIONS = [
    {
        title: '과제의 완료 표시가 LearnUs에도 반영되나요?',
        answer: '아니요. 이곳의 완료 표시는 할 일을 정리하기 위한 개인 체크예요. 과제 제출 여부와 출석 인정은 LearnUs에서 직접 확인해주세요.',
    },
    {
        title: '새 과제나 강의가 보이지 않아요.',
        answer: '대시보드나 강의 홈에서 동기화한 뒤 다시 확인해주세요. 로그인 세션이 만료됐다는 안내가 나오면 LearnUs에 로그인하고 같은 브라우저의 연결 도우미에서 다시 연결해주세요.',
    },
    {
        title: '브레인에서 어떤 자료로 답변하나요?',
        answer: '해당 강의에 저장된 학습 자료와 공지를 기준으로 답해요. 미학습 자료는 포함되지 않으며, 답변의 출처를 열어 원문을 확인할 수 있어요. 학습할 자료는 강의 브레인 화면에서 선택하세요.',
    },
    {
        title: '화면 설정이나 이름이 다른 컴퓨터와 달라요.',
        answer: '표시 이름과 테마는 브라우저별로 저장돼요. 다른 컴퓨터에서는 따로 설정할 수 있고, 사이트 데이터를 지우면 초기화돼요.',
    },
];

export default function HelpScreen() {
    const navigation = useWebNavigation();
    const { labsUnlocked, unlockLabs } = useLabs();
    const { showSuccess, showInfo, showError } = useToast();
    const taps = useRef({ count: 0, at: 0 });
    const pending = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const [unlocking, setUnlocking] = useState(false);
    const checkLabs = async () => {
        const now = Date.now();
        taps.current = {
            count: now - taps.current.at > 2000 ? 1 : taps.current.count + 1,
            at: now,
        };
        if (taps.current.count < 5 || pending.current) return;
        taps.current.count = 0;
        if (labsUnlocked || isDemoMode()) {
            showInfo(
                '실험실',
                labsUnlocked
                    ? '설정에서 실험실 기능을 확인할 수 있어요.'
                    : '미리보기에서는 계정 권한을 변경하지 않아요.',
            );
            return;
        }
        pending.current = true;
        setUnlocking(true);
        try {
            await unlockLabs();
            if (!mounted.current) return;
            showSuccess(
                '실험실 활성화',
                '설정에서 실험실 기능을 확인할 수 있어요.',
            );
        } catch {
            if (!mounted.current) return;
            showError(
                '실험실 이용 권한을 확인해주세요',
                '허용된 계정에서만 사용할 수 있어요. 연결 상태도 함께 확인해주세요.',
            );
        } finally {
            pending.current = false;
            if (mounted.current) setUnlocking(false);
        }
    };

    return (
        <div className="web-page preferences-page">
            <PageHeading
                title="도움말"
                description="사용 중 궁금한 내용을 확인하고 필요한 화면으로 이동하세요."
                actions={
                    <button
                        className="web-button"
                        onClick={() => navigation.goBack()}
                    >
                        이전 화면
                    </button>
                }
            />
            <div className="preferences-layout">
                <div className="preferences-main">
                    <section className="web-panel preferences-section">
                        <h2>빠르게 시작하기</h2>
                        <p className="preferences-note">
                            강의와 과제를 확인하고, 자료를 학습한 뒤 브레인에
                            질문해보세요.
                        </p>
                        <div className="preferences-quick-links">
                            <button
                                className="web-button primary"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new Event('learnus:tour'),
                                    )
                                }
                            >
                                주요 기능 둘러보기
                            </button>
                            <button
                                className="web-button"
                                onClick={() =>
                                    navigation.navigate('ManageCourses')
                                }
                            >
                                사용할 강의 선택
                            </button>
                        </div>
                    </section>
                    <section
                        className="web-panel preferences-faq"
                        aria-label="자주 묻는 질문"
                    >
                        {QUESTIONS.map((question) => (
                            <details key={question.title}>
                                <summary>{question.title}</summary>
                                <p>{question.answer}</p>
                            </details>
                        ))}
                    </section>
                </div>
                <aside className="preferences-aside">
                    <h2>서비스 안내</h2>
                    <p>
                        LearnUs Connect는 연세대학교의 공식 서비스가 아닌 학생
                        프로젝트예요. 비밀번호는 저장하지 않으며, 로그인 후
                        확인된 세션으로 LearnUs에 연결해요.
                    </p>
                    <div className="preferences-support-links">
                        <a href="mailto:dlwltkd@yonsei.ac.kr">
                            개발자에게 문의
                        </a>
                        <a
                            href="https://github.com/dlwltkd/learnus-scraper-app"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            프로젝트 소스 보기
                        </a>
                        <button
                            onClick={() => navigation.navigate('PrivacyPolicy')}
                        >
                            개인정보 처리방침
                        </button>
                        <button
                            onClick={() =>
                                navigation.navigate('TermsOfService')
                            }
                        >
                            이용약관
                        </button>
                    </div>
                    <button
                        className="preferences-version"
                        disabled={unlocking}
                        onClick={() => void checkLabs()}
                    >
                        LearnUs Connect · {APP_VERSION}
                    </button>
                </aside>
            </div>
        </div>
    );
}
