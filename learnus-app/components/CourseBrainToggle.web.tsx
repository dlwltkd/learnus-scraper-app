import React, { useEffect, useId, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import axios from 'axios';

import { useAuth } from '../context/AuthContext';
import { useLabs } from '../context/LabsContext';
import { LEARNED_CONTENT } from '../constants/brainContent';
import { getCourseBrainStatus, setCourseBrain } from '../services/api';
import type { BrainScope, CourseBrainState } from '../services/api';
import { isDemoMode } from '../services/demoMode';
import './web/brain-settings.css';

const DEFAULT_SCOPE: BrainScope = {
    vods: true,
    files: true,
    assignments: true,
};
const POLL_MS = 5000;

interface Props {
    courseId: number;
    courseName?: string;
    onStateChange?: (state: CourseBrainState) => void;
}

export function brainRequestError(error: unknown): string {
    if (axios.isAxiosError(error)) {
        if (error.response?.status === 401)
            return '로그인이 만료됐어요. 다시 로그인해주세요.';
        if (error.response?.status === 403)
            return '강의 브레인 이용 권한을 확인해주세요. 실험실과 브레인 설정이 모두 켜져 있어야 해요.';
        if (error.response?.status === 429)
            return '이용 한도에 도달했어요. 잠시 후 다시 시도해주세요.';
    }
    return '서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해주세요.';
}

export function useBrainPageActive(): boolean {
    const focused = useIsFocused();
    const [visible, setVisible] = useState(
        () => document.visibilityState === 'visible',
    );
    useEffect(() => {
        const update = () => setVisible(document.visibilityState === 'visible');
        document.addEventListener('visibilitychange', update);
        return () => document.removeEventListener('visibilitychange', update);
    }, []);
    return focused && visible;
}

export function BrainSwitch({
    label,
    checked,
    busy = false,
    disabled = false,
    onChange,
}: {
    label: string;
    checked: boolean;
    busy?: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <div className="brain-switch-control">
            <button
                type="button"
                className="brain-switch"
                role="switch"
                aria-label={label}
                aria-checked={checked}
                aria-busy={busy || undefined}
                disabled={disabled || busy}
                onClick={() => onChange(!checked)}
            >
                <span aria-hidden="true" />
            </button>
            <span className="brain-switch-value" aria-live="polite">
                {busy ? '저장 중…' : checked ? '켜짐' : '꺼짐'}
            </span>
        </div>
    );
}

export function BrainProgress({ state }: { state: CourseBrainState }) {
    if (
        !state.enabled ||
        (state.status !== 'queued' && state.status !== 'building')
    )
        return null;
    const value = Math.min(100, Math.max(0, state.progress));
    return (
        <div className="brain-progress">
            <progress max={100} value={value} aria-label="자료 학습 진행률" />
            <span>{Math.round(value)}%</span>
        </div>
    );
}

export function BrainScopeDialog({
    title,
    courseName,
    initialScope,
    counts,
    confirmLabel,
    readOnly = false,
    startsLearning = true,
    busy,
    error,
    onClose,
    onConfirm,
}: {
    title: string;
    courseName: string;
    initialScope: BrainScope;
    counts?: Partial<Record<keyof BrainScope, string>>;
    confirmLabel: string;
    readOnly?: boolean;
    startsLearning?: boolean;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onConfirm: (scope: BrainScope) => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const headingId = useId();
    const noteId = useId();
    const [scope, setScope] = useState(initialScope);
    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);
    return (
        <dialog
            ref={dialog}
            className="brain-scope-dialog"
            aria-labelledby={headingId}
            aria-describedby={noteId}
            onCancel={(event) => {
                event.preventDefault();
                if (!busy) onClose();
            }}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) onConfirm(scope);
                }}
            >
                <header>
                    <h2 id={headingId}>{title}</h2>
                    <p>{courseName}</p>
                </header>
                <fieldset disabled={busy}>
                    <legend>학습할 자료</legend>
                    {LEARNED_CONTENT.map((row) => (
                        <label className="brain-scope-option" key={row.key}>
                            {readOnly ? (
                                <span className="brain-scope-included">
                                    {scope[row.key] ? '포함' : '제외'}
                                </span>
                            ) : (
                                <input
                                    type="checkbox"
                                    checked={scope[row.key]}
                                    onChange={(event) =>
                                        setScope((previous) => ({
                                            ...previous,
                                            [row.key]: event.target.checked,
                                        }))
                                    }
                                />
                            )}
                            <span>
                                <strong>{row.title}</strong>
                                <small>{row.detail}</small>
                            </span>
                            {counts?.[row.key] && (
                                <span className="brain-scope-count">
                                    {counts[row.key]}
                                </span>
                            )}
                        </label>
                    ))}
                </fieldset>
                <div className="brain-scope-note" id={noteId}>
                    <p>
                        {startsLearning
                            ? '확인하면 선택한 범위에서 아직 학습하지 않은 자료의 처리가 시작돼요.'
                            : '현재 자동 학습이 꺼져 있어 범위만 저장해요. 나중에 자동 학습을 켜면 이 범위를 사용해요.'}{' '}
                        영상 전사와 자료 분석은 AI 이용량을 사용하며 일일 한도가
                        적용돼요.
                    </p>
                    <p>
                        켜 둔 범위의 새 자료도 동기화할 때 자동으로 학습해요.
                        창을 닫아도 서버 작업은 계속되며, 이미 학습한 내용은
                        보관돼요.
                    </p>
                    {!Object.values(scope).some(Boolean) && (
                        <p>
                            모두 제외하면 새 자료를 자동 학습하지 않고 기존 학습
                            내용과 저장된 공지만 사용해요.
                        </p>
                    )}
                </div>
                {error && (
                    <p className="brain-error" role="alert">
                        {error}
                    </p>
                )}
                <footer>
                    <button
                        type="button"
                        className="web-button"
                        disabled={busy}
                        onClick={onClose}
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        className="web-button primary"
                        disabled={busy}
                        aria-busy={busy || undefined}
                    >
                        {busy ? '저장 중…' : confirmLabel}
                    </button>
                </footer>
            </form>
        </dialog>
    );
}

export default function CourseBrainToggle({
    courseId,
    courseName = '이 강의',
    onStateChange,
}: Props) {
    const { isLoggedIn } = useAuth();
    const { labsUnlocked, brainEnabled } = useLabs();
    const active = useBrainPageActive();
    const allowed = isLoggedIn && labsUnlocked && brainEnabled;
    const [state, setState] = useState<Awaited<
        ReturnType<typeof getCourseBrainStatus>
    > | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [explaining, setExplaining] = useState(false);
    const [reload, setReload] = useState(0);
    const callback = useRef(onStateChange);
    const mounted = useRef(true);
    const saving = useRef(false);
    callback.current = onStateChange;

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    useEffect(() => {
        setState(null);
        setError(null);
        setExplaining(false);
    }, [courseId, allowed]);
    useEffect(() => {
        if (!allowed || !active || isDemoMode()) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const load = async () => {
            try {
                const next = await getCourseBrainStatus(courseId);
                if (cancelled) return;
                setState(next);
                setError(null);
                callback.current?.(next);
                if (
                    next.enabled &&
                    (next.status === 'queued' || next.status === 'building')
                )
                    timer = setTimeout(load, POLL_MS);
            } catch (failure) {
                if (!cancelled) setError(brainRequestError(failure));
            }
        };
        void load();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [active, allowed, courseId, reload]);

    const commit = async (enabled: boolean, scope?: BrainScope) => {
        if (!allowed || saving.current) return;
        if (isDemoMode()) {
            setError('미리보기에서는 학습 설정을 바꾸지 않아요.');
            return;
        }
        saving.current = true;
        setBusy(true);
        setDialogError(null);
        setError(null);
        try {
            const next = await setCourseBrain(courseId, {
                enabled,
                ...(scope ? { scope } : {}),
            });
            if (!mounted.current) return;
            setState((previous) =>
                previous ? { ...previous, ...next } : null,
            );
            callback.current?.(next);
            setExplaining(false);
            setReload((value) => value + 1);
        } catch (failure) {
            if (mounted.current) {
                if (enabled) setDialogError(brainRequestError(failure));
                else setError(brainRequestError(failure));
            }
        } finally {
            saving.current = false;
            if (mounted.current) setBusy(false);
        }
    };

    if (!allowed) return null;
    if (isDemoMode())
        return (
            <div className="brain-course-toggle">
                <p className="brain-muted">
                    미리보기에서는 강의 학습을 실행하지 않아요.
                </p>
            </div>
        );
    const building =
        state?.enabled &&
        (state.status === 'queued' || state.status === 'building');
    const subtitle = !state
        ? error
            ? '학습 상태를 확인하지 못했어요.'
            : '학습 상태를 불러오는 중…'
        : !state.enabled
          ? '꺼도 기존 학습 내용은 보관돼요.'
          : building
            ? state.stage || '학습을 준비하고 있어요.'
            : state.status === 'error'
              ? '일부 자료를 학습하지 못했어요.'
              : state.pending.total > 0
                ? `남은 자료 ${state.pending.total}개 · 다음 동기화 때 학습해요.`
                : state.status === 'ready'
                  ? '선택한 자료의 학습이 완료됐어요.'
                  : '자동 학습이 켜져 있어요.';
    return (
        <div className="brain-course-toggle" aria-label="강의 자동 학습 설정">
            <div className="brain-toggle-heading">
                <h3>자동 학습</h3>
                <BrainSwitch
                    label={`${courseName} 자동 학습`}
                    checked={state?.enabled ?? false}
                    busy={busy}
                    disabled={!state}
                    onChange={(value) => {
                        if (value) {
                            setDialogError(null);
                            setExplaining(true);
                        } else void commit(false);
                    }}
                />
            </div>
            <p className="brain-muted brain-toggle-description">{subtitle}</p>
            {state && <BrainProgress state={state} />}
            {(error || state?.error) && (
                <div className="brain-error" role="alert">
                    <p>{error || state?.error}</p>
                    {error && (
                        <button
                            type="button"
                            className="web-button small"
                            disabled={busy}
                            onClick={() => setReload((value) => value + 1)}
                        >
                            다시 확인
                        </button>
                    )}
                </div>
            )}
            {explaining && state && (
                <BrainScopeDialog
                    title="자동 학습을 켤까요?"
                    courseName={courseName}
                    initialScope={state.scope ?? DEFAULT_SCOPE}
                    counts={Object.fromEntries(
                        LEARNED_CONTENT.map((row) => [
                            row.key,
                            state.scope[row.key]
                                ? `${state.pending[row.key]}개 대기`
                                : '선택 시 확인',
                        ]),
                    )}
                    confirmLabel="확인하고 학습 켜기"
                    busy={busy}
                    error={dialogError}
                    onClose={() => setExplaining(false)}
                    onConfirm={(scope) => {
                        void commit(true, scope);
                    }}
                />
            )}
        </div>
    );
}
