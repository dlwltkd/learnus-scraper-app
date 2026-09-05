import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    fetchAISummary,
    getCourses,
    getDashboardOverview,
    syncAllActiveCourses,
    updateAssignmentStatus,
    type CourseSummary,
    type DashboardBriefing as Briefing,
    type DashboardAssignment,
    type DashboardOverview,
    type DashboardVod,
} from './services/api';
import { isDemoMode } from './services/demoMode';
import {
    TOUR_MOCK_COURSES,
    TOUR_MOCK_OVERVIEW,
} from './constants/tourMockData';
import { useUser } from './context/UserContext';
import { useToast } from './context/ToastContext';
import {
    EmptyState,
    LoadingState,
    PageHeading,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import { formatDeadline } from './utils/datetime';
import './components/web/dashboard.css';

type AssignmentFilter = 'pending' | 'completed' | 'missed';

function previewOverview(): DashboardOverview {
    const due = (days: number) =>
        new Date(Date.now() + days * 86400000).toISOString();
    return {
        ...TOUR_MOCK_OVERVIEW,
        stats: {
            completed_assignments_due: 1,
            total_assignments_due: 5,
            missed_assignments_count: 0,
            missed_vods_count: 1,
        },
        upcoming_assignments: [
            {
                id: 9003,
                title: '행렬과 선형변환 연습문제',
                course_id: 7004,
                course_name: '선형대수학',
                due_date: due(1),
                is_completed: false,
                url: '#',
            },
            {
                id: 9001,
                title: '중간 레포트 제출',
                course_id: 7002,
                course_name: '경영정보시스템',
                due_date: due(3),
                is_completed: false,
                url: '#',
            },
            {
                id: 9002,
                title: '프로그래밍 과제 #4',
                course_id: 7001,
                course_name: '데이터구조',
                due_date: due(5),
                is_completed: false,
                url: '#',
            },
            {
                id: 9004,
                title: '브랜드 사례 분석',
                course_id: 7003,
                course_name: '마케팅원론',
                due_date: due(6),
                is_completed: false,
                url: '#',
            },
            {
                id: 9005,
                title: '제6주차 복습 퀴즈',
                course_id: 7001,
                course_name: '데이터구조',
                due_date: due(2),
                is_completed: true,
                url: '#',
            },
        ],
        missed_assignments: [],
        available_vods: TOUR_MOCK_OVERVIEW.available_vods.map((vod) => ({
            ...vod,
            course_id: vod.course_name === '데이터구조' ? 7001 : 7003,
            start_date: null,
            url: '#',
        })),
        missed_vods: TOUR_MOCK_OVERVIEW.missed_vods.map((vod) => ({
            ...vod,
            course_id: 7001,
            start_date: null,
            end_date: due(-3),
            is_completed: false,
            url: '#',
        })),
        upcoming_vods: [],
        unchecked_vods: [],
    };
}

function dueLabel(value: string | null) {
    if (!value) return '기한 없음';
    return formatDeadline(value) || '기한 확인';
}

function shortDate(value: string | null) {
    if (!value) return '기한 없음';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('ko-KR', {
              month: 'numeric',
              day: 'numeric',
          });
}

function Metric({
    title,
    value,
    caption,
}: {
    title: string;
    value: React.ReactNode;
    caption?: string;
}) {
    return (
        <div className="dashboard-metric">
            <div className="dashboard-metric-top">
                <span>{title}</span>
            </div>
            <div className="dashboard-metric-value">{value}</div>
            {caption && <p>{caption}</p>}
        </div>
    );
}

export default function DashboardScreen() {
    const { profile } = useUser();
    const navigation = useWebNavigation();
    const { showError, showInfo, showSuccess } = useToast();
    const [overview, setOverview] = useState<DashboardOverview | null>(null);
    const [courses, setCourses] = useState<CourseSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
    const [filter, setFilter] = useState<AssignmentFilter>('pending');
    const [search, setSearch] = useState('');
    const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
    const [briefings, setBriefings] = useState<Briefing[] | null>(null);
    const [briefingBusy, setBriefingBusy] = useState(false);
    const [briefingError, setBriefingError] = useState(false);
    const [selectedBriefing, setSelectedBriefing] = useState<Briefing | null>(
        null,
    );
    const briefingDialog = useRef<HTMLDialogElement>(null);
    const mounted = useRef(true);
    const requestId = useRef(0);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const load = useCallback(async () => {
        const id = ++requestId.current;
        setError(false);
        try {
            const [data, courseList]: [DashboardOverview, CourseSummary[]] =
                isDemoMode()
                    ? [previewOverview(), TOUR_MOCK_COURSES]
                    : await Promise.all([getDashboardOverview(), getCourses()]);
            if (!mounted.current || id !== requestId.current) return;
            setOverview(data);
            setCourses(courseList);
            setRefreshedAt(new Date());
        } catch {
            if (mounted.current && id === requestId.current) setError(true);
        } finally {
            if (mounted.current && id === requestId.current) setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    const sync = async () => {
        if (syncing) return;
        if (isDemoMode()) {
            showInfo(
                '미리보기',
                '실제 연결된 강의는 전체 동기화로 새로고침할 수 있어요.',
            );
            return;
        }
        setSyncing(true);
        try {
            await syncAllActiveCourses();
            await load();
            showSuccess('동기화 완료', '최신 학습 정보를 가져왔어요.');
        } catch {
            showError('동기화 실패', '잠시 후 다시 시도해주세요.');
        } finally {
            if (mounted.current) setSyncing(false);
        }
    };

    const toggleAssignment = async (item: DashboardAssignment) => {
        const courseId =
            item.course_id ??
            courses.find((course) => course.name === item.course_name)?.id;
        if (!courseId || pendingIds.has(item.id)) return;
        setPendingIds((current) => new Set(current).add(item.id));
        try {
            if (!isDemoMode())
                await updateAssignmentStatus(
                    courseId,
                    item.id,
                    !item.is_completed,
                    true,
                );
            if (!mounted.current) return;
            setOverview((current) => {
                if (!current) return current;
                const update = (items: DashboardAssignment[]) =>
                    items.map((row) =>
                        row.id === item.id && row.course_id === item.course_id
                            ? { ...row, is_completed: !item.is_completed }
                            : row,
                    );
                return {
                    ...current,
                    upcoming_assignments: update(current.upcoming_assignments),
                    missed_assignments: update(current.missed_assignments),
                };
            });
            showSuccess(
                item.is_completed ? '미완료로 변경했어요' : '과제를 완료했어요',
                '완료 탭에서 언제든 다시 바꿀 수 있어요.',
            );
        } catch {
            showError(
                '변경하지 못했어요',
                '과제 상태를 저장할 수 없어요. 다시 시도해주세요.',
            );
        } finally {
            if (mounted.current)
                setPendingIds((current) => {
                    const next = new Set(current);
                    next.delete(item.id);
                    return next;
                });
        }
    };

    const openTask = (item: DashboardAssignment) => {
        if (isDemoMode()) {
            showInfo(
                '예시 과제',
                '연결된 계정에서는 LearnUs 과제 페이지가 새 탭으로 열려요.',
            );
            return;
        }
        try {
            const url = new URL(item.url);
            if (!['https:', 'http:'].includes(url.protocol))
                throw new Error('Invalid protocol');
            window.open(url.href, '_blank', 'noopener,noreferrer');
        } catch {
            showError(
                '페이지를 열 수 없어요',
                '강의 홈에서 과제를 확인해주세요.',
            );
        }
    };

    const generateBriefing = async () => {
        if (briefingBusy) return;
        if (isDemoMode()) {
            showInfo(
                'AI 학습 브리핑',
                '연결된 강의의 과제, 동영상, 공지를 바탕으로 학습 계획을 정리해드려요.',
            );
            return;
        }
        setBriefingBusy(true);
        setBriefingError(false);
        try {
            const result: { summaries?: Briefing[] } = await fetchAISummary();
            if (!mounted.current) return;
            if (!Array.isArray(result.summaries) || !result.summaries.length)
                setBriefingError(true);
            else setBriefings(result.summaries);
        } catch {
            if (mounted.current) setBriefingError(true);
        } finally {
            if (mounted.current) setBriefingBusy(false);
        }
    };

    const allAssignments = useMemo(
        () =>
            overview
                ? [
                      ...overview.upcoming_assignments,
                      ...overview.missed_assignments,
                  ]
                : [],
        [overview],
    );
    const counts = {
        pending:
            overview?.upcoming_assignments.filter((item) => !item.is_completed)
                .length || 0,
        completed: allAssignments.filter((item) => item.is_completed).length,
        missed:
            overview?.missed_assignments.filter((item) => !item.is_completed)
                .length || 0,
    };
    const visibleAssignments = (
        filter === 'missed'
            ? overview?.missed_assignments.filter(
                  (item) => !item.is_completed,
              ) || []
            : filter === 'completed'
              ? allAssignments.filter((item) => item.is_completed)
              : overview?.upcoming_assignments.filter(
                    (item) => !item.is_completed,
                ) || []
    ).filter((item) =>
        `${item.title} ${item.course_name || ''}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
    );
    const availableVods =
        overview?.available_vods.filter((vod) => !vod.is_completed) || [];
    const activeCourses = courses.filter((course) => course.is_active);
    const weekAssignments = allAssignments.filter((item) => {
        if (!item.due_date) return false;
        const due = new Date(item.due_date).getTime();
        return due >= Date.now() && due <= Date.now() + 7 * 86400000;
    });
    const weekComplete = weekAssignments.filter(
        (item) => item.is_completed,
    ).length;
    const completionRate = weekAssignments.length
        ? Math.round((weekComplete / weekAssignments.length) * 100)
        : 0;
    const now = new Date();
    const greeting =
        now.getHours() < 12
            ? '좋은 아침이에요'
            : now.getHours() < 18
              ? '좋은 오후예요'
              : '수고한 하루였어요';
    const name = profile.name || (isDemoMode() ? '연세인' : '');
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setDate(now.getDate() - ((now.getDay() + 6) % 7) + index);
        return date;
    });
    const goCourse = (course: CourseSummary) =>
        navigation.navigate('CourseDetail', { course });
    const courseFor = (item: DashboardVod) =>
        courses.find(
            (course) =>
                course.id === item.course_id ||
                course.name === item.course_name,
        );

    if (loading)
        return (
            <div className="web-page">
                <LoadingState />
            </div>
        );

    return (
        <div className="web-page dashboard-page">
            <PageHeading
                eyebrow={now.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                })}
                title={`${greeting}${name ? `, ${name}님` : ''}`}
                actions={
                    <>
                        <button
                            className="web-icon-button dashboard-refresh"
                            onClick={() => void load()}
                            aria-label="대시보드 새로고침"
                            title="새로고침"
                        >
                            <WebIcon name="refresh-outline" size={18} />
                        </button>
                        <button
                            className="web-button primary"
                            onClick={() => void sync()}
                            disabled={syncing}
                        >
                            {syncing ? (
                                <span className="web-spinner" />
                            ) : (
                                <WebIcon name="sync-outline" size={16} />
                            )}
                            {syncing ? '동기화 중' : '전체 동기화'}
                        </button>
                    </>
                }
            />
            {error && (
                <div className="web-error" role="alert">
                    <span>
                        학습 정보를 불러오지 못했어요. 네트워크 연결을
                        확인해주세요.
                    </span>
                    <button
                        className="web-button small"
                        onClick={() => void load()}
                    >
                        다시 시도
                    </button>
                </div>
            )}
            {!overview && !error ? (
                <EmptyState title="학습 정보를 준비하고 있어요" />
            ) : (
                overview && (
                    <>
                        <section
                            className="dashboard-metrics"
                            aria-label="학습 현황"
                        >
                            <Metric
                                title="남은 과제"
                                value={
                                    <>
                                        {counts.pending}
                                        <small>개</small>
                                    </>
                                }
                                caption={
                                    counts.missed
                                        ? `지난 마감 ${counts.missed}개도 확인하세요`
                                        : undefined
                                }
                            />
                            <Metric
                                title="시청할 강의"
                                value={
                                    <>
                                        {availableVods.length}
                                        <small>개</small>
                                    </>
                                }
                            />
                            <Metric
                                title="7일 내 과제 완료율"
                                value={
                                    <>
                                        {completionRate}
                                        <small>%</small>
                                    </>
                                }
                                caption={`${weekAssignments.length}개 중 ${weekComplete}개 완료`}
                            />
                            <Metric
                                title="수강 중인 강의"
                                value={
                                    <>
                                        {activeCourses.length}
                                        <small>개</small>
                                    </>
                                }
                            />
                        </section>
                        <div className="dashboard-grid">
                            <div className="dashboard-main-column">
                                <section
                                    className="web-panel dashboard-tasks"
                                    aria-labelledby="dashboard-task-heading"
                                >
                                    <div className="web-panel-heading">
                                        <div>
                                            <h2 id="dashboard-task-heading">
                                                과제와 퀴즈{' '}
                                                <span className="dashboard-heading-dot">
                                                    {allAssignments.length}
                                                </span>
                                            </h2>
                                        </div>
                                    </div>
                                    <div className="dashboard-task-toolbar">
                                        <div
                                            className="dashboard-tabs"
                                            role="tablist"
                                            aria-label="과제 상태"
                                        >
                                            {(
                                                [
                                                    {
                                                        key: 'pending',
                                                        label: '할 일',
                                                    },
                                                    {
                                                        key: 'completed',
                                                        label: '완료',
                                                    },
                                                    {
                                                        key: 'missed',
                                                        label: '지난 마감',
                                                    },
                                                ] as const
                                            ).map((tab) => (
                                                <button
                                                    role="tab"
                                                    aria-selected={
                                                        filter === tab.key
                                                    }
                                                    aria-controls="dashboard-task-list"
                                                    className={
                                                        filter === tab.key
                                                            ? 'active'
                                                            : ''
                                                    }
                                                    key={tab.key}
                                                    onClick={() =>
                                                        setFilter(tab.key)
                                                    }
                                                >
                                                    {tab.label}
                                                    <span>
                                                        {counts[tab.key]}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        <label className="dashboard-task-search">
                                            <WebIcon
                                                name="search-outline"
                                                size={14}
                                            />
                                            <input
                                                value={search}
                                                onChange={(event) =>
                                                    setSearch(
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="과제 검색"
                                                aria-label="과제 검색"
                                            />
                                        </label>
                                    </div>
                                    <div className="dashboard-task-labels">
                                        <span>과제명 / 강의</span>
                                        <span>마감일</span>
                                    </div>
                                    <div
                                        id="dashboard-task-list"
                                        role="tabpanel"
                                    >
                                        {visibleAssignments.map((item) => {
                                            const near = item.due_date
                                                ? new Date(
                                                      item.due_date,
                                                  ).getTime() -
                                                      Date.now() <=
                                                  2 * 86400000
                                                : false;
                                            return (
                                                <div
                                                    className={`dashboard-task-row${item.is_completed ? ' is-complete' : ''}`}
                                                    key={`${item.course_id}-${item.id}`}
                                                >
                                                    <button
                                                        className={`dashboard-checkbox${item.is_completed ? ' checked' : ''}`}
                                                        aria-label={`${item.title} ${item.is_completed ? '미완료로 변경' : '완료로 표시'}`}
                                                        aria-pressed={
                                                            item.is_completed
                                                        }
                                                        disabled={
                                                            pendingIds.has(
                                                                item.id,
                                                            ) ||
                                                            !(
                                                                item.course_id ||
                                                                courses.some(
                                                                    (course) =>
                                                                        course.name ===
                                                                        item.course_name,
                                                                )
                                                            )
                                                        }
                                                        onClick={() =>
                                                            void toggleAssignment(
                                                                item,
                                                            )
                                                        }
                                                    >
                                                        {pendingIds.has(
                                                            item.id,
                                                        ) ? (
                                                            <span className="web-spinner" />
                                                        ) : item.is_completed ? (
                                                            <WebIcon
                                                                name="checkmark"
                                                                size={12}
                                                            />
                                                        ) : null}
                                                    </button>
                                                    <button
                                                        className="dashboard-task-title"
                                                        title={`${item.title} · LearnUs에서 열기`}
                                                        onClick={() =>
                                                            openTask(item)
                                                        }
                                                    >
                                                        <strong>
                                                            {item.title}
                                                        </strong>
                                                        <span>
                                                            {item.course_name ||
                                                                '강의'}
                                                        </span>
                                                    </button>
                                                    <div className="dashboard-task-deadline">
                                                        <span
                                                            className={`dashboard-deadline-label${!item.is_completed && near ? ' is-urgent' : ''}`}
                                                        >
                                                            {item.is_completed
                                                                ? '완료'
                                                                : dueLabel(
                                                                      item.due_date,
                                                                  )}
                                                        </span>
                                                        {item.due_date && (
                                                            <small>
                                                                {shortDate(
                                                                    item.due_date,
                                                                )}
                                                            </small>
                                                        )}
                                                    </div>
                                                    <button
                                                        className="web-icon-button dashboard-task-open"
                                                        onClick={() =>
                                                            openTask(item)
                                                        }
                                                        aria-label={`${item.title} LearnUs에서 열기`}
                                                    >
                                                        <WebIcon
                                                            name="open-outline"
                                                            size={14}
                                                        />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {!visibleAssignments.length && (
                                            <EmptyState
                                                title={
                                                    search
                                                        ? '검색 결과가 없어요'
                                                        : filter === 'completed'
                                                          ? '완료한 과제가 여기에 표시돼요'
                                                          : filter === 'missed'
                                                            ? '놓친 과제가 없어요'
                                                            : '남은 과제가 없어요'
                                                }
                                                description={
                                                    search
                                                        ? '과제명이나 강의명을 바꿔 검색해보세요.'
                                                        : undefined
                                                }
                                            />
                                        )}
                                    </div>
                                    <div className="dashboard-task-footer">
                                        <span>
                                            완료 표시는 LearnUs 제출 여부와
                                            별도로 관리돼요.
                                        </span>
                                        <span>
                                            {visibleAssignments.length}개 항목
                                        </span>
                                    </div>
                                </section>
                                <section
                                    className="web-panel dashboard-course-section"
                                    aria-labelledby="dashboard-courses-heading"
                                >
                                    <div className="web-panel-heading">
                                        <div>
                                            <h2 id="dashboard-courses-heading">
                                                내 강의
                                            </h2>
                                        </div>
                                        <button
                                            className="dashboard-text-link"
                                            onClick={() =>
                                                navigation.navigate('Courses')
                                            }
                                        >
                                            전체 보기
                                            <WebIcon
                                                name="arrow-forward"
                                                size={14}
                                            />
                                        </button>
                                    </div>
                                    {activeCourses.length ? (
                                        <div className="dashboard-course-grid">
                                            {activeCourses
                                                .slice(0, 4)
                                                .map((course) => (
                                                    <button
                                                        key={course.id}
                                                        className="dashboard-course-card"
                                                        onClick={() =>
                                                            goCourse(course)
                                                        }
                                                    >
                                                        <div>
                                                            <h3>
                                                                {course.name}
                                                            </h3>
                                                            {course.professor && (
                                                                <p>
                                                                    {
                                                                        course.professor
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            title="강의를 연결해보세요"
                                            description="강의 관리에서 이번 학기에 들을 수업을 선택할 수 있어요."
                                            action={
                                                <button
                                                    className="web-button"
                                                    onClick={() =>
                                                        navigation.navigate(
                                                            'ManageCourses',
                                                        )
                                                    }
                                                >
                                                    강의 관리
                                                </button>
                                            }
                                        />
                                    )}
                                </section>
                            </div>
                            <aside
                                className="dashboard-right-column"
                                aria-label="이번 주 학습"
                            >
                                <section className="web-panel dashboard-week">
                                    <div className="dashboard-week-title">
                                        <h2>이번 주</h2>
                                        <span>{now.getMonth() + 1}월</span>
                                    </div>
                                    <div className="dashboard-week-days">
                                        {days.map((day) => {
                                            const today =
                                                day.toDateString() ===
                                                now.toDateString();
                                            const hasTask = allAssignments.some(
                                                (task) =>
                                                    task.due_date &&
                                                    new Date(
                                                        task.due_date,
                                                    ).toDateString() ===
                                                        day.toDateString(),
                                            );
                                            return (
                                                <div
                                                    key={day.toISOString()}
                                                    className={
                                                        today ? 'is-today' : ''
                                                    }
                                                    aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일${today ? ', 오늘' : ''}${hasTask ? ', 과제 마감' : ''}`}
                                                >
                                                    <span>
                                                        {day.toLocaleDateString(
                                                            'ko-KR',
                                                            {
                                                                weekday:
                                                                    'short',
                                                            },
                                                        )}
                                                    </span>
                                                    <strong>
                                                        {day.getDate()}
                                                    </strong>
                                                    <i
                                                        className={
                                                            hasTask
                                                                ? 'has-task'
                                                                : ''
                                                        }
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="dashboard-week-bottom">
                                        <span>
                                            점으로 표시된 날은 과제
                                            마감일이에요.
                                        </span>
                                    </div>
                                </section>
                                <section
                                    className="web-panel dashboard-lectures"
                                    aria-labelledby="dashboard-vod-heading"
                                >
                                    <div className="web-panel-heading">
                                        <h2 id="dashboard-vod-heading">
                                            시청할 강의
                                        </h2>
                                        <button
                                            className="web-icon-button"
                                            onClick={() =>
                                                navigation.navigate(
                                                    'VideoLectures',
                                                )
                                            }
                                            aria-label="모든 동영상 강의 보기"
                                        >
                                            <WebIcon
                                                name="arrow-forward"
                                                size={17}
                                            />
                                        </button>
                                    </div>
                                    {availableVods.length ? (
                                        availableVods.slice(0, 3).map((vod) => (
                                            <button
                                                className="dashboard-lecture-row"
                                                key={`${vod.course_id}-${vod.id}`}
                                                onClick={() => {
                                                    const course =
                                                        courseFor(vod);
                                                    if (course)
                                                        goCourse(course);
                                                    else
                                                        navigation.navigate(
                                                            'VideoLectures',
                                                        );
                                                }}
                                            >
                                                <div>
                                                    <span className="dashboard-lecture-course">
                                                        {vod.course_name ||
                                                            '동영상 강의'}
                                                    </span>
                                                    <h3>{vod.title}</h3>
                                                    <span className="dashboard-lecture-due">
                                                        {vod.end_date
                                                            ? `${shortDate(vod.end_date)}까지 시청`
                                                            : '시청 기한 없음'}
                                                    </span>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <EmptyState
                                            title="시청할 강의가 없어요"
                                            description="새 강의가 올라오면 여기에 모아둘게요."
                                        />
                                    )}
                                    {!!overview.missed_vods.length && (
                                        <button
                                            className="dashboard-missed-link"
                                            onClick={() =>
                                                navigation.navigate(
                                                    'VideoLectures',
                                                )
                                            }
                                        >
                                            놓친 강의{' '}
                                            {overview.missed_vods.length}개
                                            확인하기
                                            <WebIcon
                                                name="arrow-forward"
                                                size={12}
                                            />
                                        </button>
                                    )}
                                </section>
                                <section
                                    className="dashboard-briefing"
                                    aria-labelledby="dashboard-ai-heading"
                                >
                                    <h2 id="dashboard-ai-heading">
                                        AI 학습 브리핑
                                    </h2>
                                    <p>
                                        과제, 강의, 공지의 주요 내용을 요약해요.
                                    </p>
                                    {briefingError && (
                                        <p
                                            className="dashboard-briefing-error"
                                            role="alert"
                                        >
                                            요약을 가져오지 못했어요. 잠시 후
                                            다시 시도해주세요.
                                        </p>
                                    )}
                                    <button
                                        className="web-button"
                                        disabled={briefingBusy}
                                        onClick={() => void generateBriefing()}
                                    >
                                        {briefingBusy && (
                                            <span className="web-spinner" />
                                        )}
                                        {briefingBusy
                                            ? '브리핑 생성 중…'
                                            : briefings
                                              ? '브리핑 다시 생성'
                                              : 'AI 브리핑 만들기'}
                                    </button>
                                </section>
                            </aside>
                        </div>
                        {briefings && (
                            <section className="dashboard-briefing-results">
                                <h2>강의별 AI 브리핑</h2>
                                <div>
                                    {briefings.map((briefing) => (
                                        <button
                                            className="web-panel"
                                            key={briefing.course_id}
                                            onClick={() => {
                                                setSelectedBriefing(briefing);
                                                briefingDialog.current?.showModal();
                                            }}
                                        >
                                            <span>{briefing.course_name}</span>
                                            <h3>{briefing.status_message}</h3>
                                            <p>
                                                {briefing.insight ||
                                                    '마감과 공지사항 살펴보기'}
                                            </p>
                                            <WebIcon
                                                name="arrow-forward"
                                                size={16}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                        <footer className="dashboard-footer">
                            <span>
                                {isDemoMode()
                                    ? '예시 데이터로 미리 보는 학습 공간'
                                    : refreshedAt
                                      ? `${refreshedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}에 새로고침`
                                      : ''}
                            </span>
                        </footer>
                    </>
                )
            )}
            <dialog
                className="web-dialog dashboard-briefing-dialog"
                ref={briefingDialog}
                aria-labelledby="briefing-title"
            >
                <div className="web-panel-heading">
                    <h2 id="briefing-title">{selectedBriefing?.course_name}</h2>
                    <button
                        className="web-icon-button"
                        aria-label="브리핑 닫기"
                        onClick={() => briefingDialog.current?.close()}
                    >
                        <WebIcon name="close" />
                    </button>
                </div>
                {selectedBriefing && (
                    <div className="dashboard-briefing-body">
                        <h3>{selectedBriefing.status_message}</h3>
                        {[
                            ...(selectedBriefing.urgent?.items || []),
                            ...(selectedBriefing.upcoming?.items || []),
                        ].map((item, index) => (
                            <div
                                className="dashboard-briefing-task"
                                key={index}
                            >
                                <span>{item.title}</span>
                                <span className="web-pill">{item.due}</span>
                            </div>
                        ))}
                        {selectedBriefing.announcement?.summary && (
                            <>
                                <h4>공지사항</h4>
                                <p>{selectedBriefing.announcement.summary}</p>
                            </>
                        )}
                        {selectedBriefing.insight && (
                            <p>{selectedBriefing.insight}</p>
                        )}
                        <button
                            className="web-button primary"
                            onClick={() => {
                                const course = courses.find(
                                    (course) =>
                                        course.id ===
                                        selectedBriefing.course_id,
                                );
                                if (course) {
                                    briefingDialog.current?.close();
                                    goCourse(course);
                                }
                            }}
                        >
                            강의로 이동
                            <WebIcon name="arrow-forward" size={14} />
                        </button>
                    </div>
                )}
            </dialog>
        </div>
    );
}
