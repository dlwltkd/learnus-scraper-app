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
import { getCourses, syncCourse } from './services/api';
import { isDemoMode } from './services/demoMode';
import './components/web/courses.css';

interface Course {
    id: number;
    name: string;
    professor?: string | null;
    is_active: boolean;
}

type CourseFilter = 'active' | 'all' | 'inactive';

export default function CoursesScreen() {
    const navigation = useWebNavigation();
    const { showSuccess, showError } = useToast();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const [syncing, setSyncing] = useState<Set<number>>(new Set());
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<CourseFilter>('active');
    const [view, setView] = useState<'grid' | 'list'>('list');
    const mounted = useRef(true);

    const loadCourses = useCallback(async () => {
        setRefreshing(true);
        try {
            const result: Course[] = isDemoMode()
                ? TOUR_MOCK_COURSES
                : await getCourses();
            if (!mounted.current) return;
            setCourses(result);
            setError(false);
        } catch {
            if (mounted.current) setError(true);
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

    const handleSync = async (course: Course) => {
        if (syncing.has(course.id)) return;
        if (isDemoMode()) {
            showSuccess('미리보기', '실제 강의는 연결 후 동기화할 수 있어요.');
            return;
        }
        setSyncing((previous) => new Set(previous).add(course.id));
        try {
            await syncCourse(course.id);
            await loadCourses();
            if (mounted.current)
                showSuccess('동기화 완료', '강의 내용을 업데이트했어요.');
        } catch {
            if (mounted.current)
                showError(
                    '동기화 실패',
                    '네트워크를 확인한 뒤 다시 시도해주세요.',
                );
        } finally {
            if (mounted.current)
                setSyncing((previous) => {
                    const next = new Set(previous);
                    next.delete(course.id);
                    return next;
                });
        }
    };

    const activeCount = courses.filter(
        (course) => course.is_active !== false,
    ).length;
    const visibleCourses = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return courses.filter((course) => {
            const active = course.is_active !== false;
            if (filter === 'active' && !active) return false;
            if (filter === 'inactive' && active) return false;
            return (
                !search ||
                `${course.name} ${course.professor ?? ''}`
                    .toLocaleLowerCase()
                    .includes(search)
            );
        });
    }, [courses, query, filter]);

    return (
        <div className="web-page courses-page">
            <PageHeading
                title="내 강의실"
                actions={
                    <button
                        className="web-button"
                        onClick={() => navigation.navigate('ManageCourses')}
                    >
                        강의 관리
                    </button>
                }
            />

            <section className="courses-workspace" aria-label="강의 목록">
                <div className="courses-toolbar">
                    <div className="courses-tabs" aria-label="강의 상태">
                        {(
                            [
                                ['active', '활성 강의', activeCount],
                                ['all', '전체', courses.length],
                                [
                                    'inactive',
                                    '숨긴 강의',
                                    courses.length - activeCount,
                                ],
                            ] as const
                        ).map(([value, label, count]) => (
                            <button
                                key={value}
                                className={`courses-tab ${filter === value ? 'is-active' : ''}`}
                                aria-pressed={filter === value}
                                onClick={() => setFilter(value)}
                            >
                                {label}
                                <span>{count}</span>
                            </button>
                        ))}
                    </div>
                    <div className="courses-toolbar-actions">
                        <label className="courses-search">
                            <WebIcon name="search-outline" size={17} />
                            <input
                                className="web-input"
                                type="search"
                                aria-label="강의명 또는 교수 검색"
                                placeholder="강의명 검색"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                        </label>
                        <div
                            className="courses-view-switch"
                            aria-label="목록 보기 방식"
                        >
                            <button
                                className={`web-icon-button ${view === 'grid' ? 'is-active' : ''}`}
                                aria-label="카드로 보기"
                                aria-pressed={view === 'grid'}
                                onClick={() => setView('grid')}
                            >
                                <WebIcon name="grid-outline" size={17} />
                            </button>
                            <button
                                className={`web-icon-button ${view === 'list' ? 'is-active' : ''}`}
                                aria-label="목록으로 보기"
                                aria-pressed={view === 'list'}
                                onClick={() => setView('list')}
                            >
                                <WebIcon name="list-outline" size={19} />
                            </button>
                        </div>
                        <button
                            className="web-icon-button"
                            aria-label="강의 목록 새로고침"
                            disabled={refreshing}
                            onClick={() => {
                                void loadCourses();
                            }}
                        >
                            <span
                                className={refreshing ? 'courses-spinning' : ''}
                            >
                                <WebIcon name="refresh-outline" size={18} />
                            </span>
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="courses-error" role="alert">
                        <span>
                            강의를 불러오지 못했어요. 연결을 확인한 뒤 다시
                            시도해주세요.
                        </span>
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
                    <LoadingState label="강의를 불러오고 있어요" />
                ) : visibleCourses.length ? (
                    <div
                        className={`courses-grid ${view === 'list' ? 'courses-list' : ''}`}
                    >
                        {visibleCourses.map((course) => (
                            <article
                                className={`courses-card ${course.is_active === false ? 'courses-inactive' : ''}`}
                                key={course.id}
                            >
                                <button
                                    className="courses-card-link"
                                    aria-label={`${course.name} 강의 열기`}
                                    onClick={() =>
                                        navigation.navigate('CourseDetail', {
                                            course,
                                        })
                                    }
                                >
                                    <div className="courses-card-name">
                                        <h3>{course.name}</h3>
                                        <span
                                            className="courses-open-label"
                                            aria-hidden="true"
                                        >
                                            강의 열기
                                        </span>
                                    </div>
                                    {(course.professor ||
                                        course.is_active === false) && (
                                        <p>
                                            {[
                                                course.professor,
                                                course.is_active === false
                                                    ? '숨김'
                                                    : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    )}
                                </button>
                                <div className="courses-card-actions">
                                    <button
                                        className="courses-sync"
                                        aria-label={`${course.name} 동기화`}
                                        disabled={syncing.has(course.id)}
                                        onClick={() => {
                                            void handleSync(course);
                                        }}
                                    >
                                        {syncing.has(course.id)
                                            ? '동기화 중…'
                                            : '동기화'}
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    !error && (
                        <EmptyState
                            icon={query ? 'search-outline' : 'book-outline'}
                            title={
                                query
                                    ? '검색 결과가 없어요'
                                    : filter === 'inactive'
                                      ? '숨긴 강의가 없어요'
                                      : '등록된 강의가 없어요'
                            }
                            description={
                                query
                                    ? '다른 강의명이나 교수 이름으로 검색해보세요.'
                                    : '강의 관리에서 LearnUs 강의를 확인하고 표시할 수 있어요.'
                            }
                            action={
                                query ? (
                                    <button
                                        className="web-button"
                                        onClick={() => setQuery('')}
                                    >
                                        검색 초기화
                                    </button>
                                ) : (
                                    <button
                                        className="web-button"
                                        onClick={() =>
                                            navigation.navigate('ManageCourses')
                                        }
                                    >
                                        강의 관리
                                    </button>
                                )
                            }
                        />
                    )
                )}
                {!loading && visibleCourses.length > 0 && (
                    <p className="courses-result-count">
                        {visibleCourses.length}개의 강의
                    </p>
                )}
            </section>
        </div>
    );
}
