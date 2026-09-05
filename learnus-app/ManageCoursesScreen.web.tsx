import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
    EmptyState,
    LoadingState,
    PageHeading,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import { useToast } from './context/ToastContext';
import { TOUR_MOCK_COURSES } from './constants/tourMockData';
import {
    getCourses,
    syncCoursesList,
    toggleCourseActive,
} from './services/api';
import type { CourseSummary } from './services/api';
import { isDemoMode } from './services/demoMode';
import './components/web/management.css';

export default function ManageCoursesScreen() {
    const navigation = useWebNavigation();
    const { showSuccess, showError, showInfo } = useToast();
    const [courses, setCourses] = useState<CourseSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [discovering, setDiscovering] = useState(false);
    const [pending, setPending] = useState<Set<number>>(new Set());
    const [error, setError] = useState(false);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const mounted = useRef(true);

    const loadCourses = useCallback(async (): Promise<boolean> => {
        setRefreshing(true);
        try {
            const result = isDemoMode()
                ? TOUR_MOCK_COURSES
                : await getCourses();
            if (!mounted.current) return false;
            setCourses([...result].sort((a, b) => b.id - a.id));
            setError(false);
            return true;
        } catch {
            if (mounted.current) setError(true);
            return false;
        } finally {
            if (mounted.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    useFocusEffect(
        useCallback(() => {
            void loadCourses();
        }, [loadCourses]),
    );

    const handleToggle = async (course: CourseSummary) => {
        if (pending.has(course.id) || discovering || refreshing) return;
        if (isDemoMode()) {
            showInfo(
                '미리보기',
                '강의 표시 설정은 실제 계정을 연결한 뒤 바꿀 수 있어요.',
            );
            return;
        }
        const nextValue = !course.is_active;
        setPending((previous) => new Set(previous).add(course.id));
        setCourses((previous) =>
            previous.map((item) =>
                item.id === course.id
                    ? { ...item, is_active: nextValue }
                    : item,
            ),
        );
        try {
            await toggleCourseActive(course.id, nextValue);
        } catch {
            if (mounted.current) {
                setCourses((previous) =>
                    previous.map((item) =>
                        item.id === course.id
                            ? { ...item, is_active: course.is_active }
                            : item,
                    ),
                );
                showError(
                    '강의 설정을 저장하지 못했어요',
                    '이전 상태로 되돌렸어요. 다시 시도해주세요.',
                );
            }
        } finally {
            if (mounted.current)
                setPending((previous) => {
                    const next = new Set(previous);
                    next.delete(course.id);
                    return next;
                });
        }
    };

    const discoverCourses = async () => {
        if (discovering || pending.size || refreshing) return;
        if (isDemoMode()) {
            showInfo(
                '미리보기',
                '실제 계정을 연결하면 LearnUs 강의를 불러올 수 있어요.',
            );
            return;
        }
        setDiscovering(true);
        try {
            await syncCoursesList();
            const loaded = await loadCourses();
            if (mounted.current && loaded)
                showSuccess(
                    '강의 목록 업데이트',
                    'LearnUs에 등록된 수업을 확인했어요.',
                );
        } catch {
            if (mounted.current)
                showError(
                    '강의를 불러오지 못했어요',
                    'LearnUs 연결 상태를 확인한 뒤 다시 시도해주세요.',
                );
        } finally {
            if (mounted.current) setDiscovering(false);
        }
    };

    const activeCount = courses.filter((course) => course.is_active).length;
    const visibleCourses = useMemo(() => {
        const term = query.trim().toLocaleLowerCase();
        return courses.filter(
            (course) =>
                (filter === 'all' ||
                    (filter === 'active'
                        ? course.is_active
                        : !course.is_active)) &&
                (!term ||
                    `${course.name} ${course.professor ?? ''}`
                        .toLocaleLowerCase()
                        .includes(term)),
        );
    }, [courses, query, filter]);

    return (
        <div className="web-page management-page">
            <PageHeading
                title="강의 관리"
                description="표시한 강의의 과제와 동영상을 대시보드에 모으고 새 자료를 동기화해요."
                actions={
                    <>
                        <button
                            className="web-button"
                            onClick={() =>
                                navigation.navigate('Main', {
                                    screen: 'Courses',
                                })
                            }
                        >
                            내 강의
                        </button>
                        <button
                            className="web-button primary"
                            aria-busy={discovering}
                            disabled={
                                discovering || refreshing || pending.size > 0
                            }
                            onClick={() => {
                                void discoverCourses();
                            }}
                        >
                            {discovering
                                ? 'LearnUs에서 불러오는 중…'
                                : 'LearnUs 강의 불러오기'}
                        </button>
                    </>
                }
            />
            <div className="management-layout">
                <section
                    className="web-panel management-course-list"
                    aria-label="강의 표시 설정"
                >
                    <div className="management-toolbar">
                        <div
                            className="management-filters"
                            role="group"
                            aria-label="강의 상태"
                        >
                            {(
                                [
                                    ['all', '전체', courses.length],
                                    ['active', '표시 중', activeCount],
                                    [
                                        'inactive',
                                        '숨김',
                                        courses.length - activeCount,
                                    ],
                                ] as const
                            ).map(([value, label, count]) => (
                                <button
                                    key={value}
                                    aria-pressed={filter === value}
                                    className={
                                        filter === value ? 'is-active' : ''
                                    }
                                    onClick={() => setFilter(value)}
                                >
                                    {label}
                                    <span>{count}</span>
                                </button>
                            ))}
                        </div>
                        <button
                            className="web-icon-button"
                            aria-label="강의 목록 새로고침"
                            aria-busy={refreshing}
                            disabled={
                                discovering || refreshing || pending.size > 0
                            }
                            onClick={() => {
                                void loadCourses();
                            }}
                        >
                            <WebIcon name="refresh-outline" size={18} />
                        </button>
                    </div>
                    <label className="management-search">
                        <input
                            className="web-input"
                            type="search"
                            placeholder="강의명 또는 교수 이름 검색"
                            aria-label="관리할 강의 검색"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>
                    {error && (
                        <div className="management-error" role="alert">
                            <span>강의 목록을 불러오지 못했어요.</span>
                            <button
                                className="web-button"
                                disabled={refreshing}
                                onClick={() => {
                                    void loadCourses();
                                }}
                            >
                                다시 시도
                            </button>
                        </div>
                    )}
                    {loading ? (
                        <LoadingState label="강의 목록을 불러오고 있어요" />
                    ) : visibleCourses.length ? (
                        <ul className="management-course-rows">
                            {visibleCourses.map((course) => (
                                <li
                                    key={course.id}
                                    className={
                                        course.is_active ? '' : 'is-hidden'
                                    }
                                >
                                    <div className="management-course-info">
                                        <button
                                            className="management-course-title"
                                            onClick={() =>
                                                navigation.navigate(
                                                    'CourseDetail',
                                                    { course },
                                                )
                                            }
                                        >
                                            {course.name}
                                        </button>
                                        {course.professor && (
                                            <p>{course.professor}</p>
                                        )}
                                    </div>
                                    <span
                                        className="management-course-state"
                                        aria-live="polite"
                                    >
                                        {pending.has(course.id)
                                            ? '저장 중…'
                                            : course.is_active
                                              ? '표시 중'
                                              : '숨김'}
                                    </span>
                                    <button
                                        className="management-switch"
                                        role="switch"
                                        aria-checked={course.is_active}
                                        aria-label={`${course.name} 표시`}
                                        aria-busy={pending.has(course.id)}
                                        disabled={
                                            pending.has(course.id) ||
                                            discovering ||
                                            refreshing
                                        }
                                        onClick={() => {
                                            void handleToggle(course);
                                        }}
                                    >
                                        <span />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !error && (
                            <EmptyState
                                title={
                                    query
                                        ? '검색 결과가 없어요'
                                        : filter === 'inactive'
                                          ? '숨긴 강의가 없어요'
                                          : filter === 'active'
                                            ? '표시 중인 강의가 없어요'
                                            : '연결된 강의가 없어요'
                                }
                                description={
                                    query
                                        ? '다른 검색어로 다시 찾아보세요.'
                                        : filter === 'inactive'
                                          ? '연결된 모든 강의를 표시하고 있어요.'
                                          : filter === 'active'
                                            ? '전체 목록에서 표시할 강의를 선택하세요.'
                                            : 'LearnUs 강의 불러오기로 수강 목록을 확인하세요.'
                                }
                                action={
                                    query ? (
                                        <button
                                            className="web-button"
                                            onClick={() => setQuery('')}
                                        >
                                            검색 초기화
                                        </button>
                                    ) : filter !== 'all' ? (
                                        <button
                                            className="web-button"
                                            onClick={() => setFilter('all')}
                                        >
                                            전체 강의 보기
                                        </button>
                                    ) : undefined
                                }
                            />
                        )
                    )}
                    {!loading && (
                        <div className="management-list-footer">
                            <span>{visibleCourses.length}개의 강의</span>
                            <span aria-live="polite">
                                {pending.size > 0
                                    ? '변경사항 저장 중…'
                                    : '변경사항은 자동으로 저장돼요'}
                            </span>
                        </div>
                    )}
                </section>
            </div>
            <p className="management-footnote">
                숨긴 강의의 기존 자료는 보관돼요. 수강 신청을 변경했다면 LearnUs
                강의 불러오기로 목록을 업데이트하세요.
            </p>
        </div>
    );
}
