import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import axios from 'axios';
import {
    getAssignments,
    getBoards,
    getVods,
    syncCourse,
    updateAssignmentStatus,
    watchSingleVod,
    type CourseAssignment,
    type CourseBoard,
    type CourseBrainState,
    type CourseSummary,
    type CourseVod,
} from './services/api';
import { isDemoMode } from './services/demoMode';
import { useLabs } from './context/LabsContext';
import { useToast } from './context/ToastContext';
import CourseBrainToggle from './components/CourseBrainToggle.web';
import {
    EmptyState,
    LoadingState,
    PageHeading,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import { TOUR_MOCK_OVERVIEW } from './constants/tourMockData';
import { formatDate, formatDeadline } from './utils/datetime';
import './components/web/course-detail.css';

type CourseTab = 'overview' | 'lectures' | 'assignments';
type ItemState = 'completed' | 'missed' | 'upcoming' | 'pending';

function getState(
    completed: boolean,
    end?: string | null,
    start?: string | null,
): ItemState {
    if (completed) return 'completed';
    if (end && Date.parse(end) < Date.now()) return 'missed';
    if (start && Date.parse(start) > Date.now()) return 'upcoming';
    return 'pending';
}

function deadlineOrder(value?: string | null): number {
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isNaN(parsed) ? Infinity : parsed;
}

export default function CourseDetailScreen() {
    const { params } = useRoute();
    const { course } = params as { course: CourseSummary };
    const navigation = useWebNavigation();
    const { showSuccess, showError } = useToast();
    const { labsUnlocked, autoWatchEnabled, brainEnabled } = useLabs();
    const demo = isDemoMode();
    const canUseBrain = labsUnlocked && brainEnabled && !demo;
    const [courseBrain, setCourseBrain] = useState<CourseBrainState | null>(
        null,
    );
    const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
    const [boards, setBoards] = useState<CourseBoard[]>([]);
    const [vods, setVods] = useState<CourseVod[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [revision, setRevision] = useState(0);
    const [tab, setTab] = useState<CourseTab>('overview');
    const [query, setQuery] = useState('');
    const [pendingOnly, setPendingOnly] = useState(false);
    const [busyAssignment, setBusyAssignment] = useState<number | null>(null);
    const [busyVod, setBusyVod] = useState<number | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        async function load() {
            try {
                if (demo) {
                    const overview = TOUR_MOCK_OVERVIEW;
                    const selectedVods = overview.available_vods.filter(
                        (vod) => vod.course_name === course.name,
                    );
                    const selectedAssignments =
                        overview.upcoming_assignments.filter(
                            (item) => item.course_name === course.name,
                        );
                    if (active) {
                        setVods(
                            selectedVods.map((vod) => ({
                                ...vod,
                                start_date: null,
                                url: '',
                            })),
                        );
                        setAssignments(
                            selectedAssignments.map((item) => ({
                                ...item,
                                is_completed: false,
                                completion_overridden: false,
                            })),
                        );
                        setBoards([
                            { id: 9100, title: '공지사항', url: '' },
                            { id: 9101, title: '질문과 답변', url: '' },
                        ]);
                    }
                    return;
                }
                const [nextAssignments, nextBoards, nextVods] =
                    await Promise.all([
                        getAssignments(course.id),
                        getBoards(course.id),
                        getVods(course.id),
                    ]);
                if (active) {
                    setAssignments(nextAssignments);
                    setBoards(nextBoards);
                    setVods(nextVods);
                }
            } catch {
                if (active)
                    setError(
                        '강의 정보를 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.',
                    );
            } finally {
                if (active) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        }
        void load();
        return () => {
            active = false;
        };
    }, [course.id, course.name, demo, revision]);

    useEffect(() => {
        setTab('overview');
        setQuery('');
        setPendingOnly(false);
        setCourseBrain(null);
    }, [course.id]);

    const refresh = async () => {
        setRefreshing(true);
        try {
            if (!demo) await syncCourse(course.id);
            setRevision((value) => value + 1);
        } catch {
            setRefreshing(false);
            showError(
                '동기화 실패',
                'LearnUs 연결을 확인하고 다시 시도해주세요.',
            );
        }
    };

    const openResource = useCallback(
        (url: string, fallback: string) => {
            if (demo) {
                showSuccess(
                    '미리보기',
                    '로그인하면 LearnUs에서 강의를 열 수 있어요.',
                );
                return;
            }
            try {
                const target = new URL(url || fallback);
                if (target.protocol !== 'https:' && target.protocol !== 'http:')
                    throw new Error('Invalid resource URL');
                window.open(target.href, '_blank', 'noopener,noreferrer');
            } catch {
                showError('열기 실패', 'LearnUs 페이지를 열 수 없어요.');
            }
        },
        [demo, showError, showSuccess],
    );

    const toggleAssignment = async (assignment: CourseAssignment) => {
        setBusyAssignment(assignment.id);
        try {
            if (!demo)
                await updateAssignmentStatus(
                    course.id,
                    assignment.id,
                    !assignment.is_completed,
                );
            setAssignments((current) =>
                current.map((item) =>
                    item.id === assignment.id
                        ? {
                              ...item,
                              is_completed: !item.is_completed,
                              completion_overridden: true,
                          }
                        : item,
                ),
            );
        } catch {
            showError('저장 실패', '과제 완료 상태를 변경하지 못했어요.');
        } finally {
            setBusyAssignment(null);
        }
    };

    const autoWatch = async (vod: CourseVod) => {
        setBusyVod(vod.id);
        try {
            if (!demo) await watchSingleVod(vod.id);
            showSuccess('시청 시작', '백그라운드에서 강의를 시청하고 있어요.');
        } catch (failure) {
            const status = axios.isAxiosError(failure)
                ? failure.response?.status
                : undefined;
            showError(
                '자동 시청',
                status === 403
                    ? '설정에서 자동 시청을 켜주세요.'
                    : status === 409
                      ? '이미 시청이 진행 중이에요. 완료 후 다시 시도해주세요.'
                      : '자동 시청을 시작하지 못했어요.',
            );
        } finally {
            setBusyVod(null);
        }
    };

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const visibleVods = useMemo(
        () =>
            vods
                .filter(
                    (vod) =>
                        (!pendingOnly || !vod.is_completed) &&
                        vod.title.toLocaleLowerCase().includes(normalizedQuery),
                )
                .sort(
                    (a, b) =>
                        deadlineOrder(a.end_date) - deadlineOrder(b.end_date),
                ),
        [vods, pendingOnly, normalizedQuery],
    );
    const visibleAssignments = useMemo(
        () =>
            assignments
                .filter(
                    (assignment) =>
                        (!pendingOnly || !assignment.is_completed) &&
                        assignment.title
                            .toLocaleLowerCase()
                            .includes(normalizedQuery),
                )
                .sort(
                    (a, b) =>
                        deadlineOrder(a.due_date) - deadlineOrder(b.due_date),
                ),
        [assignments, pendingOnly, normalizedQuery],
    );
    const completedVods = vods.filter((vod) => vod.is_completed).length;
    const completedAssignments = assignments.filter(
        (assignment) => assignment.is_completed,
    ).length;
    const completed = completedVods + completedAssignments;
    const total = vods.length + assignments.length;
    const progress = total ? Math.round((completed / total) * 100) : 0;
    const tabs: { id: CourseTab; title: string; count?: number }[] = [
        { id: 'overview', title: '전체 보기' },
        { id: 'lectures', title: '동영상 강의', count: vods.length },
        { id: 'assignments', title: '과제', count: assignments.length },
    ];

    return (
        <div className="web-page course-detail-page">
            <button
                className="course-detail-back"
                onClick={() => navigation.goBack()}
            >
                <WebIcon name="arrow-back-outline" size={16} /> 이전 화면
            </button>
            <PageHeading
                title={course.name}
                description={course.professor || undefined}
                actions={
                    <>
                        {canUseBrain && courseBrain?.enabled && (
                            <button
                                className="web-button primary"
                                onClick={() =>
                                    navigation.navigate('CourseBrainChat', {
                                        courseId: course.id,
                                        courseName: course.name,
                                    })
                                }
                            >
                                브레인 채팅
                            </button>
                        )}
                        <button
                            className="web-button"
                            onClick={() => void refresh()}
                            disabled={refreshing || loading}
                        >
                            {refreshing ? '동기화 중…' : '강의 동기화'}
                        </button>
                    </>
                }
            />

            <div className="course-detail-summary" aria-label="강의 학습 현황">
                <span>
                    강의{' '}
                    <strong>
                        {completedVods} / {vods.length}
                    </strong>{' '}
                    시청
                </span>
                <span>
                    과제{' '}
                    <strong>
                        {completedAssignments} / {assignments.length}
                    </strong>{' '}
                    완료
                </span>
                <span>
                    전체 진행률 <strong>{progress}%</strong>
                </span>
            </div>

            {error && (
                <div className="course-detail-error" role="alert">
                    <span>{error}</span>
                    <button
                        className="web-button"
                        onClick={() => setRevision((value) => value + 1)}
                    >
                        다시 시도
                    </button>
                </div>
            )}

            <div className="course-detail-layout">
                <section className="course-detail-main">
                    <nav
                        className="course-detail-tabs"
                        aria-label="강의 콘텐츠"
                    >
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                aria-pressed={tab === item.id}
                                className={tab === item.id ? 'is-active' : ''}
                                onClick={() => setTab(item.id)}
                            >
                                {item.title}
                                {item.count !== undefined && (
                                    <span>{item.count}</span>
                                )}
                            </button>
                        ))}
                    </nav>
                    <div className="course-detail-toolbar">
                        <label className="course-detail-search">
                            <WebIcon name="search-outline" size={18} />
                            <input
                                aria-label="강의와 과제 검색"
                                placeholder="강의와 과제 검색"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                        </label>
                        <label className="course-detail-filter">
                            <input
                                type="checkbox"
                                checked={pendingOnly}
                                onChange={(event) =>
                                    setPendingOnly(event.target.checked)
                                }
                            />
                            미완료만 보기
                        </label>
                    </div>

                    {loading ? (
                        <LoadingState label="강의 정보를 불러오는 중이에요" />
                    ) : (
                        <>
                            {(tab === 'overview' || tab === 'lectures') && (
                                <section className="course-detail-section">
                                    <header className="course-detail-section-heading">
                                        <h2>
                                            동영상 강의{' '}
                                            <span>{visibleVods.length}</span>
                                        </h2>
                                        <span>마감일순</span>
                                    </header>
                                    {visibleVods.length === 0 ? (
                                        <EmptyState
                                            title={
                                                query || pendingOnly
                                                    ? '조건에 맞는 강의가 없어요'
                                                    : '아직 동영상 강의가 없어요'
                                            }
                                        />
                                    ) : (
                                        <div className="course-detail-items">
                                            {visibleVods.map((vod) => {
                                                const state = getState(
                                                    vod.is_completed,
                                                    vod.end_date,
                                                    vod.start_date,
                                                );
                                                return (
                                                    <article
                                                        className={`course-detail-lecture is-${state}`}
                                                        key={vod.id}
                                                    >
                                                        <div className="course-detail-item-copy">
                                                            <h3>{vod.title}</h3>
                                                            <div className="course-detail-item-meta">
                                                                {vod.is_completed && (
                                                                    <span>
                                                                        시청
                                                                        완료
                                                                    </span>
                                                                )}
                                                                <span
                                                                    className={
                                                                        state ===
                                                                        'missed'
                                                                            ? 'course-detail-overdue'
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {state ===
                                                                    'upcoming'
                                                                        ? `${formatDate(vod.start_date)} 공개`
                                                                        : formatDeadline(
                                                                              vod.end_date,
                                                                          ) ||
                                                                          '마감일 없음'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="course-detail-item-actions">
                                                            <button
                                                                className="course-detail-text-button"
                                                                onClick={() =>
                                                                    navigation.navigate(
                                                                        'VodTranscript',
                                                                        {
                                                                            vodMoodleId:
                                                                                vod.id,
                                                                            title: vod.title,
                                                                            courseName:
                                                                                course.name,
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                텍스트 추출
                                                            </button>
                                                            <button
                                                                className="web-button course-detail-watch"
                                                                onClick={() =>
                                                                    openResource(
                                                                        vod.url,
                                                                        `https://ys.learnus.org/mod/vod/viewer.php?id=${vod.id}`,
                                                                    )
                                                                }
                                                            >
                                                                시청
                                                            </button>
                                                            {labsUnlocked &&
                                                                autoWatchEnabled && (
                                                                    <button
                                                                        className="course-detail-text-button"
                                                                        aria-label={`${vod.title} 자동 시청`}
                                                                        disabled={
                                                                            vod.is_completed ||
                                                                            busyVod !==
                                                                                null
                                                                        }
                                                                        onClick={() =>
                                                                            void autoWatch(
                                                                                vod,
                                                                            )
                                                                        }
                                                                    >
                                                                        자동
                                                                        시청
                                                                    </button>
                                                                )}
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            )}

                            {(tab === 'overview' || tab === 'assignments') && (
                                <section className="course-detail-section">
                                    <header className="course-detail-section-heading">
                                        <h2>
                                            과제{' '}
                                            <span>
                                                {visibleAssignments.length}
                                            </span>
                                        </h2>
                                        <span>마감일순</span>
                                    </header>
                                    {visibleAssignments.length === 0 ? (
                                        <EmptyState
                                            title={
                                                query || pendingOnly
                                                    ? '조건에 맞는 과제가 없어요'
                                                    : '아직 등록된 과제가 없어요'
                                            }
                                        />
                                    ) : (
                                        <div className="course-detail-items">
                                            {visibleAssignments.map(
                                                (assignment) => {
                                                    const state = getState(
                                                        assignment.is_completed,
                                                        assignment.due_date,
                                                    );
                                                    return (
                                                        <article
                                                            className={`course-detail-assignment is-${state}`}
                                                            key={assignment.id}
                                                        >
                                                            <label className="course-detail-assignment-check">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        assignment.is_completed
                                                                    }
                                                                    disabled={
                                                                        busyAssignment !==
                                                                        null
                                                                    }
                                                                    aria-label={`${assignment.title} 완료`}
                                                                    onChange={() =>
                                                                        void toggleAssignment(
                                                                            assignment,
                                                                        )
                                                                    }
                                                                />
                                                            </label>
                                                            <div className="course-detail-item-copy">
                                                                <h3>
                                                                    {
                                                                        assignment.title
                                                                    }
                                                                </h3>
                                                                <div className="course-detail-item-meta">
                                                                    <span
                                                                        className={
                                                                            state ===
                                                                            'missed'
                                                                                ? 'course-detail-overdue'
                                                                                : undefined
                                                                        }
                                                                    >
                                                                        {formatDeadline(
                                                                            assignment.due_date,
                                                                        ) ||
                                                                            '마감일 없음'}
                                                                    </span>
                                                                    {assignment.completion_overridden && (
                                                                        <span>
                                                                            직접
                                                                            표시
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                className="course-detail-text-button"
                                                                onClick={() =>
                                                                    openResource(
                                                                        assignment.url,
                                                                        `https://ys.learnus.org/mod/assign/view.php?id=${assignment.id}`,
                                                                    )
                                                                }
                                                            >
                                                                과제 보기
                                                            </button>
                                                        </article>
                                                    );
                                                },
                                            )}
                                        </div>
                                    )}
                                </section>
                            )}
                        </>
                    )}
                </section>

                <aside className="course-detail-sidebar">
                    {canUseBrain && (
                        <section
                            className="course-detail-brain"
                            aria-labelledby="course-brain-heading"
                        >
                            <h2 id="course-brain-heading">강의 브레인</h2>
                            <CourseBrainToggle
                                courseId={course.id}
                                courseName={course.name}
                                onStateChange={setCourseBrain}
                            />
                            <button
                                className="web-button primary"
                                disabled={!courseBrain?.enabled}
                                aria-describedby="course-brain-chat-hint"
                                onClick={() =>
                                    navigation.navigate('CourseBrainChat', {
                                        courseId: course.id,
                                        courseName: course.name,
                                    })
                                }
                            >
                                채팅 열기
                            </button>
                            <p id="course-brain-chat-hint">
                                {!courseBrain
                                    ? '학습 상태를 확인하고 있어요.'
                                    : !courseBrain.enabled
                                      ? '이 강의 학습을 켜면 자료를 바탕으로 질문할 수 있어요.'
                                      : courseBrain.status === 'building' ||
                                          courseBrain.status === 'queued'
                                        ? '이미 학습한 자료로 먼저 질문할 수 있어요.'
                                        : '답변과 함께 근거 자료를 확인할 수 있어요.'}
                            </p>
                            <button
                                className="web-button"
                                onClick={() =>
                                    navigation.navigate('CourseLibrary', {
                                        courseId: course.id,
                                        courseName: course.name,
                                    })
                                }
                            >
                                강의 자료 보기
                            </button>
                        </section>
                    )}
                    <section className="course-detail-side-panel">
                        <h2>게시판</h2>
                        {boards.length ? (
                            <div className="course-detail-board-links">
                                {boards.map((board) => (
                                    <button
                                        key={board.id}
                                        onClick={() =>
                                            navigation.navigate('Board', {
                                                board,
                                                courseName: course.name,
                                            })
                                        }
                                    >
                                        {board.title}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p>등록된 게시판이 없어요.</p>
                        )}
                    </section>
                    <section className="course-detail-side-panel">
                        <h2>학습 도구</h2>
                        <button
                            className="course-detail-tool"
                            onClick={() =>
                                navigation.navigate('FlashcardDeckList')
                            }
                        >
                            플래시카드
                        </button>
                    </section>
                </aside>
            </div>
        </div>
    );
}
