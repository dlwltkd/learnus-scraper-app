import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    BrainProgress,
    BrainScopeDialog,
    BrainSwitch,
    brainRequestError,
    useBrainPageActive,
} from './components/CourseBrainToggle.web';
import {
    EmptyState,
    LoadingState,
    PageHeading,
    useWebNavigation,
} from './components/web/WebUI';
import { useAuth } from './context/AuthContext';
import { useLabs } from './context/LabsContext';
import { LEARNED_CONTENT } from './constants/brainContent';
import {
    getBrainCourses,
    rebuildCourseBrain,
    setCourseBrain,
} from './services/api';
import type { BrainCourse, BrainScope } from './services/api';
import { isDemoMode } from './services/demoMode';
import './components/web/brain-settings.css';

type Confirmation = {
    course: BrainCourse;
    kind: 'enable' | 'scope' | 'rebuild';
};

function courseStatus(course: BrainCourse): string {
    if (!course.enabled)
        return course.learned.chars > 0
            ? '자동 학습 꺼짐 · 기존 학습 내용 보관 중'
            : '자동 학습 꺼짐';
    if (course.status === 'queued' || course.status === 'building')
        return course.stage || '학습 준비 중';
    if (course.status === 'error') return '일부 자료 학습 실패';
    if (course.pending.total > 0) return `남은 자료 ${course.pending.total}개`;
    return course.status === 'ready'
        ? '선택한 자료 학습 완료'
        : '자동 학습 켜짐';
}

export default function BrainSettingsScreen() {
    const navigation = useWebNavigation();
    const { isLoggedIn } = useAuth();
    const { labsUnlocked, brainEnabled, isLoading: labsLoading } = useLabs();
    const active = useBrainPageActive();
    const allowed = isLoggedIn && labsUnlocked && brainEnabled;
    const demo = isDemoMode();
    const [courses, setCourses] = useState<BrainCourse[] | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rowErrors, setRowErrors] = useState<Record<number, string | null>>(
        {},
    );
    const [busy, setBusy] = useState<number | null>(null);
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
    const [reload, setReload] = useState(0);
    const mounted = useRef(true);
    const saving = useRef(false);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    useEffect(() => {
        if (!allowed) {
            setCourses(null);
            setConfirmation(null);
        }
    }, [allowed]);
    useEffect(() => {
        if (!allowed || !active) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        setRefreshing(true);
        const load = async () => {
            try {
                const result = demo ? { courses: [] } : await getBrainCourses();
                if (cancelled) return;
                setCourses(result.courses);
                setError(null);
                if (
                    !demo &&
                    result.courses.some(
                        (course) =>
                            course.enabled &&
                            (course.status === 'queued' ||
                                course.status === 'building'),
                    )
                )
                    timer = setTimeout(load, 5000);
            } catch (failure) {
                if (!cancelled) setError(brainRequestError(failure));
            } finally {
                if (!cancelled) setRefreshing(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [active, allowed, demo, reload]);

    const save = async (
        course: BrainCourse,
        kind: 'enable' | 'scope' | 'rebuild' | 'disable',
        scope?: BrainScope,
    ) => {
        if (!allowed || saving.current) return;
        if (isDemoMode()) {
            setDialogError('미리보기에서는 학습 설정을 바꾸지 않아요.');
            return;
        }
        saving.current = true;
        setBusy(course.id);
        setDialogError(null);
        setRowErrors((previous) => ({ ...previous, [course.id]: null }));
        try {
            const next =
                kind === 'rebuild'
                    ? await rebuildCourseBrain(course.id)
                    : await setCourseBrain(
                          course.id,
                          kind === 'disable'
                              ? { enabled: false }
                              : kind === 'enable'
                                ? { enabled: true, scope }
                                : { scope },
                      );
            if (!mounted.current) return;
            setCourses(
                (previous) =>
                    previous?.map((item) =>
                        item.id === course.id ? { ...item, ...next } : item,
                    ) ?? null,
            );
            setConfirmation(null);
            setReload((value) => value + 1);
        } catch (failure) {
            if (mounted.current) {
                if (kind === 'disable')
                    setRowErrors((previous) => ({
                        ...previous,
                        [course.id]: brainRequestError(failure),
                    }));
                else setDialogError(brainRequestError(failure));
            }
        } finally {
            saving.current = false;
            if (mounted.current) setBusy(null);
        }
    };
    const openConfirmation = (
        course: BrainCourse,
        kind: Confirmation['kind'],
    ) => {
        setDialogError(null);
        setConfirmation({ course, kind });
    };
    const visibleCourses = useMemo(
        () =>
            (courses ?? []).filter(
                (course) =>
                    course.name
                        .toLocaleLowerCase()
                        .includes(query.trim().toLocaleLowerCase()) &&
                    (filter === 'all' ||
                        (filter === 'enabled'
                            ? course.enabled
                            : !course.enabled)),
            ),
        [courses, query, filter],
    );
    const enabledCount =
        courses?.filter((course) => course.enabled).length ?? 0;
    const totalChars =
        courses?.reduce((sum, course) => sum + course.learned.chars, 0) ?? 0;

    return (
        <div className="web-page brain-settings-page">
            <PageHeading
                title="강의 브레인"
                description="강의 자료를 학습하고, 출처와 함께 답변을 확인하세요."
                actions={
                    allowed && (
                        <button
                            type="button"
                            className="web-button"
                            disabled={refreshing || busy !== null}
                            aria-busy={refreshing || undefined}
                            onClick={() => setReload((value) => value + 1)}
                        >
                            {refreshing ? '확인 중…' : '새로고침'}
                        </button>
                    )
                }
            />
            {labsLoading ? (
                <LoadingState label="이용 설정을 확인하고 있어요" />
            ) : !allowed ? (
                <EmptyState
                    title="강의 브레인이 꺼져 있어요"
                    description="실험실 이용 권한과 강의 브레인 설정이 모두 필요해요."
                    action={
                        <button
                            type="button"
                            className="web-button"
                            onClick={() => navigation.navigate('Labs')}
                        >
                            실험실 설정
                        </button>
                    }
                />
            ) : (
                <>
                    {error && (
                        <div
                            className="brain-error brain-page-error"
                            role="alert"
                        >
                            <p>{error}</p>
                            <button
                                type="button"
                                className="web-button small"
                                disabled={refreshing}
                                onClick={() => setReload((value) => value + 1)}
                            >
                                다시 시도
                            </button>
                        </div>
                    )}
                    {!courses ? (
                        !error && (
                            <LoadingState label="강의 학습 상태를 불러오고 있어요" />
                        )
                    ) : (
                        <>
                            <div className="brain-summary">
                                <span>
                                    자동 학습{' '}
                                    <strong>{enabledCount}개 강의</strong>
                                </span>
                                <span>
                                    저장된 텍스트 {totalChars.toLocaleString()}
                                    자
                                </span>
                            </div>
                            <section
                                className="web-panel brain-course-panel"
                                aria-label="강의별 브레인 설정"
                            >
                                <div className="brain-toolbar">
                                    <label className="brain-search">
                                        <span className="brain-sr-only">
                                            강의 검색
                                        </span>
                                        <input
                                            className="web-input"
                                            type="search"
                                            placeholder="강의 검색"
                                            value={query}
                                            onChange={(event) =>
                                                setQuery(event.target.value)
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span className="brain-sr-only">
                                            자동 학습 필터
                                        </span>
                                        <select
                                            className="web-select"
                                            value={filter}
                                            onChange={(event) =>
                                                setFilter(
                                                    event.target
                                                        .value as typeof filter,
                                                )
                                            }
                                        >
                                            <option value="all">
                                                모든 강의
                                            </option>
                                            <option value="enabled">
                                                자동 학습 켜짐
                                            </option>
                                            <option value="disabled">
                                                자동 학습 꺼짐
                                            </option>
                                        </select>
                                    </label>
                                    <span className="brain-result-count">
                                        {visibleCourses.length}개 강의
                                    </span>
                                </div>
                                {!visibleCourses.length ? (
                                    <EmptyState
                                        title={
                                            courses?.length
                                                ? '검색 결과가 없어요'
                                                : demo
                                                  ? '미리보기에서는 학습을 실행하지 않아요'
                                                  : '표시할 강의가 없어요'
                                        }
                                        description={
                                            courses?.length
                                                ? '검색어 또는 필터를 바꿔보세요.'
                                                : '강의 관리에서 사용 중인 강의를 확인해주세요.'
                                        }
                                        action={
                                            courses?.length ? (
                                                <button
                                                    type="button"
                                                    className="web-button"
                                                    onClick={() => {
                                                        setQuery('');
                                                        setFilter('all');
                                                    }}
                                                >
                                                    검색 초기화
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="web-button"
                                                    onClick={() =>
                                                        navigation.navigate(
                                                            'ManageCourses',
                                                        )
                                                    }
                                                >
                                                    강의 관리
                                                </button>
                                            )
                                        }
                                    />
                                ) : (
                                    <ul className="brain-course-list">
                                        {visibleCourses.map((course) => {
                                            const building =
                                                course.enabled &&
                                                (course.status === 'queued' ||
                                                    course.status ===
                                                        'building');
                                            return (
                                                <li key={course.id}>
                                                    <div className="brain-course-main">
                                                        <div className="brain-course-heading">
                                                            <h2>
                                                                {course.name}
                                                            </h2>
                                                            <span
                                                                className={`brain-course-status${building ? ' is-active' : ''}${course.status === 'error' && course.enabled ? ' is-error' : ''}`}
                                                            >
                                                                {courseStatus(
                                                                    course,
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="brain-course-switch">
                                                            <span>
                                                                자동 학습
                                                            </span>
                                                            <BrainSwitch
                                                                label={`${course.name} 자동 학습`}
                                                                checked={
                                                                    course.enabled
                                                                }
                                                                busy={
                                                                    busy ===
                                                                    course.id
                                                                }
                                                                disabled={
                                                                    busy !==
                                                                        null ||
                                                                    refreshing
                                                                }
                                                                onChange={(
                                                                    value,
                                                                ) =>
                                                                    value
                                                                        ? openConfirmation(
                                                                              course,
                                                                              'enable',
                                                                          )
                                                                        : void save(
                                                                              course,
                                                                              'disable',
                                                                          )
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                    <BrainProgress
                                                        state={course}
                                                    />
                                                    <dl
                                                        className="brain-course-counts"
                                                        aria-label="학습 완료 / 전체 자료 수"
                                                    >
                                                        {LEARNED_CONTENT.map(
                                                            (row) => (
                                                                <div
                                                                    key={
                                                                        row.key
                                                                    }
                                                                >
                                                                    <dt>
                                                                        {
                                                                            row.title
                                                                        }
                                                                        {!course
                                                                            .scope[
                                                                            row
                                                                                .key
                                                                        ] && (
                                                                            <span>
                                                                                {' '}
                                                                                제외
                                                                            </span>
                                                                        )}
                                                                    </dt>
                                                                    <dd>
                                                                        {
                                                                            course
                                                                                .learned[
                                                                                row
                                                                                    .key
                                                                            ]
                                                                        }{' '}
                                                                        /{' '}
                                                                        {
                                                                            course
                                                                                .learned[
                                                                                `total_${row.key}`
                                                                            ]
                                                                        }
                                                                    </dd>
                                                                </div>
                                                            ),
                                                        )}
                                                    </dl>
                                                    {(course.learned.chars >
                                                        0 ||
                                                        course.learned
                                                            .captioned_pages >
                                                            0) && (
                                                        <p className="brain-muted brain-caption-count">
                                                            학습 텍스트{' '}
                                                            {course.learned.chars.toLocaleString()}
                                                            자
                                                            {course.learned
                                                                .captioned_pages >
                                                                0 &&
                                                                ` · 슬라이드 그림 ${course.learned.captioned_pages}쪽 포함`}
                                                        </p>
                                                    )}
                                                    {(rowErrors[course.id] ||
                                                        course.error) && (
                                                        <p
                                                            className="brain-error"
                                                            role="alert"
                                                        >
                                                            {rowErrors[
                                                                course.id
                                                            ] || course.error}
                                                        </p>
                                                    )}
                                                    <div className="brain-course-actions">
                                                        <button
                                                            type="button"
                                                            className={`web-button${course.enabled ? ' primary' : ''}`}
                                                            disabled={
                                                                !course.enabled
                                                            }
                                                            title={
                                                                !course.enabled
                                                                    ? '자동 학습을 켜면 채팅을 사용할 수 있어요.'
                                                                    : undefined
                                                            }
                                                            onClick={() =>
                                                                navigation.navigate(
                                                                    'CourseBrainChat',
                                                                    {
                                                                        courseId:
                                                                            course.id,
                                                                        courseName:
                                                                            course.name,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            채팅 열기
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="web-button"
                                                            onClick={() =>
                                                                navigation.navigate(
                                                                    'CourseLibrary',
                                                                    {
                                                                        courseId:
                                                                            course.id,
                                                                        courseName:
                                                                            course.name,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            자료 둘러보기
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="web-button"
                                                            disabled={
                                                                busy !== null ||
                                                                refreshing
                                                            }
                                                            onClick={() =>
                                                                openConfirmation(
                                                                    course,
                                                                    'scope',
                                                                )
                                                            }
                                                        >
                                                            학습 범위
                                                        </button>
                                                        {course.enabled &&
                                                            !building &&
                                                            (course.pending
                                                                .total > 0 ||
                                                                course.status ===
                                                                    'error') && (
                                                                <button
                                                                    type="button"
                                                                    className="web-button"
                                                                    disabled={
                                                                        busy !==
                                                                            null ||
                                                                        refreshing
                                                                    }
                                                                    onClick={() =>
                                                                        openConfirmation(
                                                                            course,
                                                                            'rebuild',
                                                                        )
                                                                    }
                                                                >
                                                                    남은 자료
                                                                    학습
                                                                </button>
                                                            )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>
                            <details className="brain-help">
                                <summary>자동 학습과 자료 범위 안내</summary>
                                <div>
                                    {LEARNED_CONTENT.map((row) => (
                                        <p key={row.key}>
                                            <strong>{row.title}</strong> ·{' '}
                                            {row.detail}
                                        </p>
                                    ))}
                                    <p>
                                        공지는 평소 동기화한 내용이 포함돼요. 새
                                        자료는 선택한 범위에 따라 다음 동기화 때
                                        학습하며, 이미 학습한 내용은 다시
                                        처리하지 않아요.
                                    </p>
                                    <p>
                                        자동 학습을 꺼도 기존 내용은 보관돼요.
                                        개별 자료는 자료 둘러보기에서 선택해
                                        학습할 수 있어요.
                                    </p>
                                </div>
                            </details>
                        </>
                    )}
                </>
            )}
            {confirmation && (
                <BrainScopeDialog
                    key={`${confirmation.course.id}-${confirmation.kind}`}
                    title={
                        confirmation.kind === 'enable'
                            ? '자동 학습을 켤까요?'
                            : confirmation.kind === 'scope'
                              ? '학습 범위 변경'
                              : '남은 자료를 학습할까요?'
                    }
                    courseName={confirmation.course.name}
                    initialScope={confirmation.course.scope}
                    counts={Object.fromEntries(
                        LEARNED_CONTENT.map((row) => [
                            row.key,
                            `${confirmation.course.learned[row.key]} / ${confirmation.course.learned[`total_${row.key}`]} 학습`,
                        ]),
                    )}
                    readOnly={confirmation.kind === 'rebuild'}
                    startsLearning={
                        confirmation.kind !== 'scope' ||
                        confirmation.course.enabled
                    }
                    confirmLabel={
                        confirmation.kind === 'enable'
                            ? '확인하고 학습 켜기'
                            : confirmation.kind === 'scope'
                              ? '범위 저장'
                              : '확인하고 학습 시작'
                    }
                    busy={busy !== null}
                    error={dialogError}
                    onClose={() => setConfirmation(null)}
                    onConfirm={(scope) => {
                        void save(
                            confirmation.course,
                            confirmation.kind,
                            scope,
                        );
                    }}
                />
            )}
        </div>
    );
}
