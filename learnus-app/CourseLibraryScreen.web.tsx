import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import axios from 'axios';
import { useLabs } from './context/LabsContext';
import { useToast } from './context/ToastContext';
import { useAuth } from './context/AuthContext';
import { isDemoMode } from './services/demoMode';
import {
    brainRequestError,
    useBrainPageActive,
} from './components/CourseBrainToggle.web';
import {
    getCourseLibrary,
    getCourses,
    learnLibraryItem,
    rebuildCourseBrain,
    type CourseLibrary,
    type LibraryItem,
    type LibraryItemType,
} from './services/api';
import {
    EmptyState,
    LoadingState,
    PageHeading,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import { shortenWeek } from './utils/week';
import './components/web/library.css';

type ItemState = 'learned' | 'learning' | 'pending' | 'failed' | 'unavailable';
type TypeFilter = 'all' | Exclude<LibraryItemType, 'label'>;

export const libraryTypeLabels: Record<LibraryItemType, string> = {
    file: '자료',
    label: '안내',
    vod: '동영상',
    assignment: '과제',
    board: '공지',
};

export const libraryStateLabels: Record<ItemState, string> = {
    learned: '학습됨',
    learning: '학습 중',
    pending: '미학습',
    failed: '학습 실패',
    unavailable: '텍스트 없음',
};

export function libraryItemState(item: LibraryItem): ItemState {
    if (item.learning || item.status === 'queued' || item.status === 'running')
        return 'learning';
    if (item.in_corpus) return 'learned';
    if (item.status === 'error' || item.status === 'failed') return 'failed';
    if (['skipped', 'empty', 'too_large'].includes(item.status || ''))
        return 'unavailable';
    return 'pending';
}

export function isLearnable(
    item: LibraryItem,
): item is LibraryItem & { type: 'file' | 'vod' | 'assignment' } {
    return (
        item.type === 'file' ||
        item.type === 'vod' ||
        item.type === 'assignment'
    );
}

function itemMeta(item: LibraryItem): string {
    if (item.type === 'file')
        return [item.kind?.toUpperCase(), item.pages ? `${item.pages}쪽` : '']
            .filter(Boolean)
            .join(' · ');
    if (item.type === 'vod')
        return [
            item.duration ? `${Math.round(item.duration / 60)}분` : '',
            item.completed ? '시청 완료' : '',
        ]
            .filter(Boolean)
            .join(' · ');
    if (item.type === 'assignment')
        return [
            item.due_date ? `마감 ${item.due_date.slice(0, 16)}` : '',
            item.completed ? '완료 표시됨' : '',
        ]
            .filter(Boolean)
            .join(' · ');
    if (item.type === 'board') return `게시글 ${item.posts || 0}개`;
    return '';
}

export default function CourseLibraryScreen() {
    const { params } = useRoute();
    const { courseId, courseName } = params as {
        courseId: number;
        courseName?: string;
    };
    const navigation = useWebNavigation();
    const { labsUnlocked, brainEnabled, isLoading: labsLoading } = useLabs();
    const { showConfirm, showError } = useToast();
    const { isLoggedIn } = useAuth();
    const activePage = useBrainPageActive();
    const allowed = isLoggedIn && labsUnlocked && brainEnabled && !isDemoMode();
    const [library, setLibrary] = useState<CourseLibrary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [forbidden, setForbidden] = useState(false);
    const [revision, setRevision] = useState(0);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [stateFilter, setStateFilter] = useState<ItemState | 'all'>('all');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [busy, setBusy] = useState<Record<string, boolean>>({});
    const [rebuilding, setRebuilding] = useState(false);
    const requests = useRef(new Set<string>());
    const mounted = useRef(false);
    const canWrite = useRef(false);
    canWrite.current = allowed && !forbidden && activePage;

    useFocusEffect(
        useCallback(() => {
            mounted.current = true;
            return () => {
                mounted.current = false;
            };
        }, []),
    );

    useEffect(() => {
        if (!allowed || !activePage) return;
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const load = async () => {
            try {
                const next = await getCourseLibrary(courseId);
                if (!active) return;
                setLibrary(next);
                setError('');
                setForbidden(false);
                const working =
                    next.brain.status === 'queued' ||
                    next.brain.status === 'building' ||
                    next.sections.some((section) =>
                        section.items.some(
                            (item) => libraryItemState(item) === 'learning',
                        ),
                    );
                if (working) timer = setTimeout(load, 5000);
            } catch (reason) {
                if (!active) return;
                setForbidden(
                    axios.isAxiosError(reason) &&
                        reason.response?.status === 403,
                );
                setError(
                    '자료를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
                );
            } finally {
                if (active) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        };
        void load();
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [allowed, activePage, courseId, revision]);

    const sections = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        return (library?.sections || [])
            .map((section) => ({
                ...section,
                items: section.items.filter(
                    (item) =>
                        (typeFilter === 'all' ||
                            item.type === typeFilter ||
                            (typeFilter === 'file' && item.type === 'label')) &&
                        (stateFilter === 'all' ||
                            libraryItemState(item) === stateFilter) &&
                        (!needle ||
                            `${item.title} ${section.week}`
                                .toLocaleLowerCase()
                                .includes(needle)),
                ),
            }))
            .filter((section) => section.items.length > 0);
    }, [library, query, stateFilter, typeFilter]);

    const refresh = () => {
        setRefreshing(true);
        setRevision((value) => value + 1);
    };
    const title = library?.course.name || courseName || '강의';
    const courseHome = async () => {
        try {
            const course = (await getCourses()).find(
                (candidate) => candidate.id === courseId,
            );
            if (course) navigation.navigate('CourseDetail', { course });
            else
                showError(
                    '강의를 찾을 수 없어요',
                    '강의 목록에서 다시 확인해 주세요.',
                );
        } catch {
            showError(
                '강의를 불러오지 못했어요',
                '잠시 후 다시 시도해 주세요.',
            );
        }
    };

    const learn = (item: LibraryItem) => {
        if (
            !allowed ||
            forbidden ||
            !isLearnable(item) ||
            libraryItemState(item) === 'learning'
        )
            return;
        const key = `${item.type}-${item.id}`;
        showConfirm(
            '이 자료를 학습할까요?',
            `“${item.title}”의 내용을 브레인이 참고할 수 있게 준비해요. 동영상 변환과 문서 분석에는 AI 사용량이 발생할 수 있어요.`,
            () => {
                if (
                    requests.current.has(key) ||
                    !mounted.current ||
                    !canWrite.current
                )
                    return;
                requests.current.add(key);
                setBusy((previous) => ({ ...previous, [key]: true }));
                void learnLibraryItem(courseId, item.type, item.id)
                    .then(() => {
                        if (mounted.current) refresh();
                    })
                    .catch((reason) => {
                        if (!mounted.current) return;
                        if (
                            axios.isAxiosError(reason) &&
                            reason.response?.status === 403
                        )
                            setForbidden(true);
                        showError(
                            '학습을 시작하지 못했어요',
                            brainRequestError(reason),
                        );
                    })
                    .finally(() => {
                        requests.current.delete(key);
                        if (mounted.current)
                            setBusy((previous) => ({
                                ...previous,
                                [key]: false,
                            }));
                    });
            },
            '학습하기',
        );
    };

    const rebuild = () => {
        if (!allowed || forbidden || !library?.brain.enabled) return;
        showConfirm(
            '남은 자료를 학습할까요?',
            '설정한 학습 범위에서 아직 준비되지 않은 자료를 처리해요. 이미 학습한 내용은 유지되며, 동영상 변환과 문서 분석에는 AI 사용량이 발생할 수 있어요.',
            () => {
                if (
                    requests.current.has('rebuild') ||
                    !mounted.current ||
                    !canWrite.current
                )
                    return;
                requests.current.add('rebuild');
                setRebuilding(true);
                void rebuildCourseBrain(courseId)
                    .then(() => {
                        if (mounted.current) refresh();
                    })
                    .catch((reason) => {
                        if (!mounted.current) return;
                        if (
                            axios.isAxiosError(reason) &&
                            reason.response?.status === 403
                        )
                            setForbidden(true);
                        showError(
                            '학습을 시작하지 못했어요',
                            brainRequestError(reason),
                        );
                    })
                    .finally(() => {
                        requests.current.delete('rebuild');
                        if (mounted.current) setRebuilding(false);
                    });
            },
            '학습하기',
        );
    };

    if (labsLoading || (allowed && loading))
        return <LoadingState label="강의 자료를 불러오는 중" />;
    if (!allowed || forbidden)
        return (
            <div className="web-page">
                <EmptyState
                    title="강의 브레인을 사용할 수 없어요"
                    description="실험실 이용 권한과 강의 브레인 설정을 확인해 주세요."
                    action={
                        <button
                            className="web-button"
                            onClick={() => navigation.navigate('Labs')}
                        >
                            실험실 설정
                        </button>
                    }
                />
            </div>
        );
    if (!library)
        return (
            <div className="web-page">
                <EmptyState
                    title="자료를 불러오지 못했어요"
                    description={error}
                    action={
                        <button className="web-button" onClick={refresh}>
                            다시 시도
                        </button>
                    }
                />
            </div>
        );

    const working =
        library.brain.status === 'queued' ||
        library.brain.status === 'building';
    const canChat = library.brain.enabled;
    const resultCount = sections.reduce(
        (count, section) => count + section.items.length,
        0,
    );

    return (
        <div className="web-page library-page">
            <nav className="library-breadcrumb" aria-label="현재 위치">
                <button onClick={() => navigation.navigate('BrainSettings')}>
                    강의 브레인
                </button>
                <span>/</span>
                <button onClick={() => void courseHome()}>{title}</button>
                <span>/</span>
                <span aria-current="page">자료</span>
            </nav>
            <PageHeading
                title="강의 자료"
                description={title}
                actions={
                    <>
                        <button
                            className="web-button"
                            onClick={refresh}
                            disabled={refreshing}
                            aria-busy={refreshing}
                        >
                            {refreshing ? '새로고침 중' : '새로고침'}
                        </button>
                        <button
                            className="web-button primary"
                            disabled={!canChat}
                            title={
                                !canChat
                                    ? '강의 학습을 켜면 질문할 수 있어요.'
                                    : undefined
                            }
                            onClick={() =>
                                navigation.navigate('CourseBrainChat', {
                                    courseId,
                                    courseName: title,
                                })
                            }
                        >
                            브레인에 질문
                        </button>
                    </>
                }
            />
            {error && (
                <div className="web-error" role="alert">
                    {error}
                </div>
            )}
            <section
                className="library-overview web-panel"
                aria-label="자료 학습 현황"
            >
                <div>
                    <p className="library-overview-count">
                        <strong>
                            {library.stats.in_corpus.toLocaleString()}
                        </strong>{' '}
                        / {library.stats.total_items.toLocaleString()}개 학습됨
                    </p>
                    <p className="library-note">
                        {working
                            ? library.brain.stage ||
                              '자료를 준비하고 있어요. 준비된 내용은 먼저 읽고 질문할 수 있어요.'
                            : library.brain.status === 'error'
                              ? '일부 자료의 학습이 중단됐어요. 남은 자료를 다시 학습할 수 있어요.'
                              : !library.brain.enabled
                                ? '강의 학습이 꺼져 있어요. 개별 자료는 읽거나 학습할 수 있어요.'
                                : '학습된 내용을 기준으로 답변하며, 미학습 자료는 답변에 포함되지 않아요.'}
                    </p>
                    {working && (
                        <progress
                            className="library-progress"
                            value={Math.max(
                                0,
                                Math.min(100, library.brain.progress),
                            )}
                            max="100"
                            aria-label="강의 학습 진행률"
                        />
                    )}
                </div>
                <div className="library-overview-actions">
                    <button
                        className="web-button"
                        onClick={() => navigation.navigate('BrainSettings')}
                    >
                        학습 설정
                    </button>
                    {library.brain.enabled && (
                        <button
                            className="web-button"
                            onClick={rebuild}
                            disabled={rebuilding || working}
                            aria-busy={rebuilding}
                        >
                            {working
                                ? '학습 진행 중'
                                : rebuilding
                                  ? '요청 중'
                                  : '남은 자료 학습'}
                        </button>
                    )}
                </div>
            </section>
            <div className="library-toolbar">
                <div
                    className="library-filters"
                    role="group"
                    aria-label="자료 유형"
                >
                    {(
                        [
                            'all',
                            'file',
                            'vod',
                            'assignment',
                            'board',
                        ] as TypeFilter[]
                    ).map((type) => (
                        <button
                            key={type}
                            className={typeFilter === type ? 'is-active' : ''}
                            aria-pressed={typeFilter === type}
                            onClick={() => setTypeFilter(type)}
                        >
                            {type === 'all' ? '전체' : libraryTypeLabels[type]}
                        </button>
                    ))}
                </div>
                <div className="library-search-controls">
                    <input
                        className="web-input"
                        type="search"
                        aria-label="자료 검색"
                        placeholder="자료명 또는 주차 검색"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <select
                        className="web-select"
                        aria-label="학습 상태"
                        value={stateFilter}
                        onChange={(event) =>
                            setStateFilter(
                                event.target.value as ItemState | 'all',
                            )
                        }
                    >
                        <option value="all">모든 상태</option>
                        {Object.entries(libraryStateLabels).map(
                            ([state, label]) => (
                                <option key={state} value={state}>
                                    {label}
                                </option>
                            ),
                        )}
                    </select>
                </div>
            </div>
            <p className="library-result-count" aria-live="polite">
                자료 {resultCount.toLocaleString()}개
            </p>
            {!sections.length ? (
                <div className="web-panel">
                    <EmptyState
                        title={
                            library.stats.total_items
                                ? '조건에 맞는 자료가 없어요'
                                : '등록된 강의 자료가 없어요'
                        }
                        description={
                            library.stats.total_items
                                ? '검색어나 학습 상태를 바꿔 보세요.'
                                : '강의 홈에서 LearnUs와 동기화한 뒤 다시 확인해 주세요.'
                        }
                        action={
                            library.stats.total_items ? (
                                <button
                                    className="web-button"
                                    onClick={() => {
                                        setQuery('');
                                        setTypeFilter('all');
                                        setStateFilter('all');
                                    }}
                                >
                                    필터 초기화
                                </button>
                            ) : (
                                <button
                                    className="web-button"
                                    onClick={() => void courseHome()}
                                >
                                    강의 홈
                                </button>
                            )
                        }
                    />
                </div>
            ) : (
                <div className="library-sections">
                    {sections.map((section) => {
                        const key = `${section.section ?? 'other'}-${section.week}`;
                        const closed = !!collapsed[key];
                        return (
                            <section
                                className="library-section web-panel"
                                key={key}
                            >
                                <h2>
                                    <button
                                        className="library-section-heading"
                                        aria-expanded={!closed}
                                        onClick={() =>
                                            setCollapsed((previous) => ({
                                                ...previous,
                                                [key]: !closed,
                                            }))
                                        }
                                    >
                                        <WebIcon
                                            name={
                                                closed
                                                    ? 'chevron-forward'
                                                    : 'chevron-down'
                                            }
                                            size={15}
                                        />
                                        <span>{shortenWeek(section.week)}</span>
                                        <small>{section.items.length}</small>
                                    </button>
                                </h2>
                                {!closed && (
                                    <div className="library-rows">
                                        {section.items.map((item) => {
                                            const state =
                                                libraryItemState(item);
                                            const pending =
                                                !!busy[
                                                    `${item.type}-${item.id}`
                                                ];
                                            return (
                                                <div
                                                    className="library-row"
                                                    key={`${item.type}-${item.id}`}
                                                >
                                                    <span className="library-type">
                                                        {
                                                            libraryTypeLabels[
                                                                item.type
                                                            ]
                                                        }
                                                    </span>
                                                    <button
                                                        className="library-item-title"
                                                        onClick={() =>
                                                            navigation.navigate(
                                                                'LibraryItem',
                                                                {
                                                                    item,
                                                                    courseId,
                                                                    courseName:
                                                                        title,
                                                                },
                                                            )
                                                        }
                                                    >
                                                        <span>
                                                            {item.title}
                                                        </span>
                                                        {itemMeta(item) && (
                                                            <small>
                                                                {itemMeta(item)}
                                                            </small>
                                                        )}
                                                    </button>
                                                    <span
                                                        className={`library-status is-${state}`}
                                                    >
                                                        {pending
                                                            ? '요청 중'
                                                            : libraryStateLabels[
                                                                  state
                                                              ]}
                                                    </span>
                                                    <div className="library-row-action">
                                                        {!item.in_corpus &&
                                                            isLearnable(
                                                                item,
                                                            ) && (
                                                                <button
                                                                    className="web-button small"
                                                                    onClick={() =>
                                                                        learn(
                                                                            item,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        pending ||
                                                                        state ===
                                                                            'learning'
                                                                    }
                                                                    aria-label={`${item.title} ${state === 'failed' ? '학습 다시 시도' : '학습하기'}`}
                                                                >
                                                                    {pending ||
                                                                    state ===
                                                                        'learning'
                                                                        ? '학습 중'
                                                                        : state ===
                                                                            'failed'
                                                                          ? '다시 시도'
                                                                          : '학습하기'}
                                                                </button>
                                                            )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
