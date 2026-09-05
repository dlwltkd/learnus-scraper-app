import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useLabs } from './context/LabsContext';
import { useToast } from './context/ToastContext';
import { isDemoMode } from './services/demoMode';
import {
    BrainSwitch,
    brainRequestError,
} from './components/CourseBrainToggle.web';
import {
    EmptyState,
    LoadingState,
    PageHeading,
    useWebNavigation,
} from './components/web/WebUI';
import './components/web/preferences.css';

export default function LabsScreen() {
    const navigation = useWebNavigation();
    const { isLoggedIn } = useAuth();
    const {
        labsUnlocked,
        brainEnabled,
        autoWatchEnabled,
        setBrainEnabled,
        setAutoWatchEnabled,
        refreshLabs,
        isLoading,
    } = useLabs();
    const { showConfirm } = useToast();
    const [saving, setSaving] = useState<'brain' | 'watch' | null>(null);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState('');
    const mounted = useRef(true);
    const submitting = useRef(false);
    const permitted = useRef(false);
    permitted.current = isLoggedIn && labsUnlocked && !isDemoMode();
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const commit = async (setting: 'brain' | 'watch', enabled: boolean) => {
        if (!permitted.current || !mounted.current || submitting.current)
            return;
        submitting.current = true;
        setSaving(setting);
        setError('');
        setSaved('');
        try {
            await (setting === 'brain'
                ? setBrainEnabled(enabled)
                : setAutoWatchEnabled(enabled));
            if (mounted.current) setSaved('계정 설정을 저장했어요.');
        } catch (failure) {
            if (mounted.current) setError(brainRequestError(failure));
        } finally {
            submitting.current = false;
            if (mounted.current) setSaving(null);
        }
    };
    const changeBrain = (enabled: boolean) =>
        showConfirm(
            enabled ? '강의 브레인을 켤까요?' : '강의 브레인을 끌까요?',
            enabled
                ? '강의별로 학습할 자료를 선택할 수 있어요. 영상 전사와 자료 분석에는 AI 이용량과 일일 한도가 적용돼요. 이미 켜 둔 강의의 학습 설정도 확인해주세요.'
                : '브레인 채팅과 자료 보기 기능을 사용할 수 없게 돼요. 저장된 학습 내용은 유지되며, 이미 요청한 서버 작업은 계속될 수 있어요.',
            () => {
                void commit('brain', enabled);
            },
            enabled ? '기능 켜기' : '기능 끄기',
        );

    return (
        <div className="web-page preferences-page">
            <PageHeading
                title="실험실"
                description="계정에 허용된 실험 기능을 관리하세요."
                actions={
                    <button
                        className="web-button"
                        onClick={() => navigation.goBack()}
                    >
                        이전 화면
                    </button>
                }
            />
            {isLoading ? (
                <LoadingState label="실험실 설정을 확인하는 중" />
            ) : !isLoggedIn || !labsUnlocked || isDemoMode() ? (
                <EmptyState
                    title="실험실 이용 권한이 필요해요"
                    description="허용된 계정에서만 사용할 수 있어요. 미리보기에서는 설정을 바꾸지 않아요."
                    action={
                        <button
                            className="web-button"
                            onClick={() => void refreshLabs()}
                        >
                            접근 상태 다시 확인
                        </button>
                    }
                />
            ) : (
                <div className="preferences-layout">
                    <div className="preferences-main">
                        <section className="web-panel preferences-section">
                            <div className="preferences-toggle-row">
                                <div>
                                    <h2>강의 브레인</h2>
                                    <p>
                                        학습한 강의 자료를 바탕으로 질문하고
                                        출처를 확인해요.
                                    </p>
                                </div>
                                <BrainSwitch
                                    label="강의 브레인 사용"
                                    checked={brainEnabled}
                                    busy={saving === 'brain'}
                                    disabled={saving !== null}
                                    onChange={changeBrain}
                                />
                            </div>
                            <div className="preferences-feature-detail">
                                <p>
                                    강의별 자동 학습과 자료 범위는 브레인
                                    화면에서 따로 관리해요.
                                </p>
                                <button
                                    className="web-button primary"
                                    disabled={!brainEnabled || saving !== null}
                                    onClick={() =>
                                        navigation.navigate('BrainSettings')
                                    }
                                >
                                    강의 브레인 열기
                                </button>
                            </div>
                        </section>
                        <section className="web-panel preferences-section">
                            <div className="preferences-toggle-row">
                                <div>
                                    <h2>자동 시청 메뉴</h2>
                                    <p>
                                        동영상 화면의 모두 시청과 강의별 자동
                                        시청 메뉴를 표시해요.
                                    </p>
                                </div>
                                <BrainSwitch
                                    label="자동 시청 메뉴 표시"
                                    checked={autoWatchEnabled}
                                    busy={saving === 'watch'}
                                    disabled={saving !== null}
                                    onChange={(enabled) => {
                                        void commit('watch', enabled);
                                    }}
                                />
                            </div>
                            <p className="preferences-note">
                                이 스위치만 켜서는 시청이 시작되지 않아요. 실제
                                출석 반영은 LearnUs에서 확인해주세요.
                            </p>
                        </section>
                        {error && (
                            <p className="preferences-error" role="alert">
                                {error}
                            </p>
                        )}
                        <p className="preferences-status" role="status">
                            {saved}
                        </p>
                    </div>
                    <aside className="preferences-aside">
                        <h2>계정 전체에 적용돼요</h2>
                        <p>실험실 설정은 같은 계정의 앱과 웹에서 공유해요.</p>
                        <h3>사용 전 확인해주세요</h3>
                        <p>
                            실험 기능은 학교 정책과 강의 설정에 따라 다르게
                            동작할 수 있어요. 출석이나 학습 기록의 반영을
                            보장하지 않아요.
                        </p>
                    </aside>
                </div>
            )}
        </div>
    );
}
