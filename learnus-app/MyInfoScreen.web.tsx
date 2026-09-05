import React, { useEffect, useId, useRef, useState } from 'react';
import { useUser } from './context/UserContext';
import {
    LoadingState,
    PageHeading,
    useWebNavigation,
} from './components/web/WebUI';
import './components/web/preferences.css';

export default function MyInfoScreen() {
    const { profile, updateName, isLoading } = useUser();
    const navigation = useWebNavigation();
    const nameNoteId = useId();
    const [name, setName] = useState(profile.name);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const edited = useRef(false);
    const mounted = useRef(true);
    const submitting = useRef(false);
    const changed = name.trim() !== profile.name;

    useEffect(() => {
        if (!edited.current) setName(profile.name);
    }, [profile.name]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!changed || submitting.current) return;
        submitting.current = true;
        setSaving(true);
        setError('');
        setMessage('');
        try {
            await updateName(name.trim());
            if (mounted.current) {
                edited.current = false;
                setName(name.trim());
                setMessage('이 브라우저에 저장했어요.');
            }
        } catch {
            if (mounted.current)
                setError(
                    '저장하지 못했어요. 브라우저의 저장 공간 설정을 확인하고 다시 시도해주세요.',
                );
        } finally {
            submitting.current = false;
            if (mounted.current) setSaving(false);
        }
    };

    return (
        <div className="web-page preferences-page">
            <PageHeading
                title="내 정보"
                description="대시보드와 메뉴에 표시할 이름을 정하세요."
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
                <LoadingState label="내 정보를 불러오는 중" />
            ) : (
                <div className="preferences-layout">
                    <form
                        className="web-panel preferences-section"
                        onSubmit={(event) => void save(event)}
                    >
                        <header>
                            <h2>표시 이름</h2>
                            <p>
                                LearnUs의 학적 정보나 로그인 계정은 바뀌지
                                않아요.
                            </p>
                        </header>
                        <label className="preferences-field">
                            <span>이름</span>
                            <input
                                className="web-input"
                                value={name}
                                maxLength={20}
                                disabled={saving}
                                autoComplete="off"
                                placeholder="표시할 이름"
                                aria-describedby={nameNoteId}
                                onChange={(event) => {
                                    edited.current = true;
                                    setName(event.target.value);
                                    setMessage('');
                                    setError('');
                                }}
                            />
                        </label>
                        <div
                            className="preferences-field-note"
                            id={nameNoteId}
                        >
                            <span>비워두면 기본 이름으로 표시해요.</span>
                            <span>{name.length} / 20</span>
                        </div>
                        {error && (
                            <p className="preferences-error" role="alert">
                                {error}
                            </p>
                        )}
                        <footer className="preferences-save">
                            <p role="status">
                                {message ||
                                    (changed
                                        ? '아직 저장하지 않은 변경 사항이 있어요.'
                                        : '변경 사항이 없어요.')}
                            </p>
                            <button
                                className="web-button primary"
                                type="submit"
                                disabled={!changed || saving}
                                aria-busy={saving}
                            >
                                {saving ? '저장 중…' : '변경 사항 저장'}
                            </button>
                        </footer>
                    </form>
                    <aside className="preferences-aside">
                        <h2>이 브라우저에만 저장돼요</h2>
                        <p>
                            이름은 서버로 전송되지 않아요. 다른 기기의 이름은
                            별도로 설정할 수 있어요.
                        </p>
                        <p>
                            브라우저의 사이트 데이터를 지우면 표시 이름도
                            초기화돼요.
                        </p>
                    </aside>
                </div>
            )}
        </div>
    );
}
