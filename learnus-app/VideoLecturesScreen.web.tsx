import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

import {
    EmptyState,
    LoadingState,
    PageHeading,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import { useLabs } from './context/LabsContext';
import { useToast } from './context/ToastContext';
import { TOUR_MOCK_OVERVIEW } from './constants/tourMockData';
import {
    getDashboardOverview,
    getFlashcardDeck,
    getFlashcardDecks,
    watchAllVods,
    watchSingleVod,
} from './services/api';
import type { FlashcardDeckSummary } from './services/api';
import { isDemoMode } from './services/demoMode';
import { formatDate, formatDeadline } from './utils/datetime';
import './components/web/lectures.css';

interface Lecture {
    id: number;
    title: string;
    course_id?: number | null;
    course_name?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    is_completed?: boolean;
    url?: string;
}

type LectureStatus =
    | 'available'
    | 'completed'
    | 'missed'
    | 'upcoming'
    | 'unchecked';
type LectureFilter = 'all' | LectureStatus;
type LectureRow = Lecture & { status: LectureStatus };
interface LectureOverview {
    available_vods: Lecture[];
    missed_vods: Lecture[];
    upcoming_vods: Lecture[];
    unchecked_vods: Lecture[];
}

const STATUS_LABELS: Record<LectureStatus, string> = {
    available: '시청 가능',
    completed: '시청 완료',
    missed: '기간 종료',
    upcoming: '오픈 예정',
    unchecked: '출석 미반영',
};

function deadlineOrder(item: LectureRow): number {
    const value = item.status === 'upcoming' ? item.start_date : item.end_date;
    const timestamp = value ? new Date(value).getTime() : NaN;
    return Number.isNaN(timestamp) ? Infinity : timestamp;
}

function LectureDeadline({ item }: { item: LectureRow }) {
    const value = item.status === 'upcoming' ? item.start_date : item.end_date;
    const date = value ? new Date(value) : null;
    const end =
        item.status === 'upcoming' && item.end_date
            ? new Date(item.end_date)
            : null;
    const upcomingEnd =
        end && !Number.isNaN(end.getTime()) ? (
            <time className="lectures-date" dateTime={end.toISOString()}>
                {formatDate(end)} 마감
            </time>
        ) : null;
    if (!date || Number.isNaN(date.getTime())) {
        return (
            <div className="lectures-period">
                <span className="lectures-date">
                    {item.status === 'upcoming'
                        ? '공개 일정 미정'
                        : '마감일 미정'}
                </span>
                {upcomingEnd}
            </div>
        );
    }
    const exactDate = new Intl.DateTimeFormat('ko-KR', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
    const urgent =
        item.status === 'available' &&
        date.getTime() > Date.now() &&
        date.getTime() - Date.now() < 86400000;
    return (
        <div className={`lectures-period${urgent ? ' is-urgent' : ''}`}>
            {item.status === 'available' && (
                <span className="lectures-deadline">
                    {formatDeadline(value)}
                </span>
            )}
            <time
                className={
                    item.status === 'available'
                        ? 'lectures-date'
                        : 'lectures-deadline'
                }
                dateTime={date.toISOString()}
            >
                {exactDate} {item.status === 'upcoming' ? '공개' : '마감'}
            </time>
            {upcomingEnd}
        </div>
    );
}

function LectureActions({
    item,
    onClose,
    onWatch,
    onTranscribe,
    onAutoWatch,
    autoWatchEnabled,
}: {
    item: LectureRow;
    onClose: () => void;
    onWatch: () => void;
    onTranscribe: () => void;
    onAutoWatch: () => void;
    autoWatchEnabled: boolean;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);

    return (
        <dialog
            ref={dialog}
            className="lectures-dialog"
            aria-labelledby="lectures-dialog-title"
            onCancel={onClose}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="lectures-dialog-content">
                <div className="lectures-dialog-heading">
                    <p>{item.course_name}</p>
                    <button
                        className="web-icon-button"
                        aria-label="닫기"
                        onClick={onClose}
                    >
                        <WebIcon name="close-outline" size={21} />
                    </button>
                </div>
                <h2 id="lectures-dialog-title">{item.title}</h2>
                <div className="lectures-dialog-meta">
                    <span
                        className={`lectures-status lectures-status-${item.status}`}
                    >
                        {STATUS_LABELS[item.status]}
                    </span>
                    <LectureDeadline item={item} />
                </div>
                <div className="lectures-dialog-actions">
                    <button className="lectures-dialog-watch" onClick={onWatch}>
                        <span>
                            <strong>LearnUs에서 시청</strong>
                            <small>강의를 새 창에서 열어요</small>
                        </span>
                    </button>
                    <button onClick={onTranscribe}>
                        <span>
                            <strong>텍스트·요약 보기</strong>
                            <small>강의 내용을 읽고 복습해요</small>
                        </span>
                    </button>
                    {autoWatchEnabled && (
                        <button
                            onClick={onAutoWatch}
                            disabled={item.is_completed}
                        >
                            <span>
                                <strong>자동 시청</strong>
                                <small>
                                    {item.is_completed
                                        ? '이미 시청 완료된 강의예요'
                                        : '백그라운드에서 자동으로 시청'}
                                </small>
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </dialog>
    );
}

export default function VideoLecturesScreen() {
    const navigation = useWebNavigation();
    const { labsUnlocked, autoWatchEnabled } = useLabs();
    const { showSuccess, showError } = useToast();
    const [data, setData] = useState<LectureOverview | null>(null);
    const [decks, setDecks] = useState<FlashcardDeckSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const [deckError, setDeckError] = useState(false);
    const [watching, setWatching] = useState(false);
    const [openingDeck, setOpeningDeck] = useState<number | null>(null);
    const [filter, setFilter] = useState<LectureFilter>('all');
    const [courseFilter, setCourseFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<LectureRow | null>(null);
    const mounted = useRef(true);
    const canAutoWatch = labsUnlocked && autoWatchEnabled;

    const loadData = useCallback(async () => {
        setRefreshing(true);
        try {
            if (isDemoMode()) {
                setData(TOUR_MOCK_OVERVIEW);
                setDecks([]);
                setError(false);
                setDeckError(false);
                return;
            }
            const [overview, flashcards] = await Promise.allSettled([
                getDashboardOverview(),
                getFlashcardDecks(),
            ]);
            if (!mounted.current) return;
            if (overview.status === 'fulfilled') {
                setData(overview.value);
                setError(false);
            } else {
                setError(true);
            }
            if (flashcards.status === 'fulfilled') {
                setDecks(flashcards.value.decks);
                setDeckError(false);
            } else {
                setDeckError(true);
            }
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
            void loadData();
        }, [loadData]),
    );

    const rows = useMemo<LectureRow[]>(
        () =>
            data
                ? [
                      ...data.available_vods.map((item) => ({
                          ...item,
                          status: item.is_completed
                              ? ('completed' as const)
                              : ('available' as const),
                      })),
                      ...data.missed_vods.map((item) => ({
                          ...item,
                          status: 'missed' as const,
                      })),
                      ...data.upcoming_vods.map((item) => ({
                          ...item,
                          status: 'upcoming' as const,
                      })),
                      ...data.unchecked_vods.map((item) => ({
                          ...item,
                          status: 'unchecked' as const,
                      })),
                  ]
                : [],
        [data],
    );

    const courseNames = useMemo(
        () =>
            [
                ...new Set(
                    rows
                        .map((item) => item.course_name)
                        .filter((name): name is string => Boolean(name)),
                ),
            ].sort((a, b) => a.localeCompare(b, 'ko')),
        [rows],
    );
    const visibleRows = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return rows
            .filter(
                (item) =>
                    (filter === 'all' || item.status === filter) &&
                    (courseFilter === 'all' ||
                        item.course_name === courseFilter) &&
                    (!search ||
                        `${item.title} ${item.course_name ?? ''}`
                            .toLocaleLowerCase()
                            .includes(search)),
            )
            .sort((a, b) => {
                const rank = {
                    available: 0,
                    missed: 1,
                    upcoming: 2,
                    unchecked: 3,
                    completed: 4,
                };
                return (
                    rank[a.status] - rank[b.status] ||
                    deadlineOrder(a) - deadlineOrder(b) ||
                    a.id - b.id
                );
            });
    }, [rows, filter, courseFilter, query]);
    const pendingCount = rows.filter(
        (item) => item.status === 'available',
    ).length;

    const sampleNotice = () =>
        showSuccess('미리보기', '실제 강의를 연결하면 사용할 수 있어요.');

    const openLecture = (item: LectureRow) => {
        setSelected(null);
        if (isDemoMode()) return sampleNotice();
        const url =
            item.url ||
            `https://ys.learnus.org/mod/vod/viewer.php?id=${item.id}`;
        try {
            const target = new URL(url, 'https://ys.learnus.org');
            if (!['https:', 'http:'].includes(target.protocol))
                throw new Error('Unsupported lecture URL');
            window.open(target.href, '_blank', 'noopener,noreferrer');
        } catch {
            showError(
                '강의를 열 수 없어요',
                'LearnUs 강의 주소를 확인해주세요.',
            );
        }
    };

    const openTranscript = (item: LectureRow) => {
        setSelected(null);
        navigation.navigate('VodTranscript', {
            vodMoodleId: item.id,
            title: item.title,
            courseName: item.course_name ?? '',
        });
    };

    const startWatching = async (item?: LectureRow) => {
        setSelected(null);
        if (watching || !canAutoWatch) return;
        if (isDemoMode()) return sampleNotice();
        if (item?.is_completed) {
            showSuccess('이미 완료', '이미 시청 완료된 강의예요.');
            return;
        }
        setWatching(true);
        try {
            const result = item
                ? await watchSingleVod(item.id)
                : await watchAllVods();
            if (mounted.current)
                showSuccess(
                    result.status === 'already_running'
                        ? '이미 진행 중'
                        : '시청 시작',
                    '백그라운드에서 강의를 시청하고 있어요.',
                );
        } catch (failure) {
            if (!mounted.current) return;
            const status = axios.isAxiosError(failure)
                ? failure.response?.status
                : undefined;
            showError(
                status === 409 ? '진행 중' : '자동 시청 실패',
                status === 403
                    ? '설정의 개발자 옵션에서 자동 시청을 켜주세요.'
                    : status === 409
                      ? '전체 시청이 이미 실행 중이에요. 완료 후 다시 시도해주세요.'
                      : '네트워크를 확인한 뒤 다시 시도해주세요.',
            );
        } finally {
            if (mounted.current) setWatching(false);
        }
    };

    const openDeck = async (deck: FlashcardDeckSummary) => {
        if (openingDeck !== null) return;
        if (isDemoMode()) return sampleNotice();
        setOpeningDeck(deck.id);
        try {
            const result = await getFlashcardDeck(deck.id);
            if (mounted.current)
                navigation.navigate('FlashcardStudy', {
                    cards: result.cards,
                    deckName: result.name,
                    deckId: result.id,
                    courseName: result.course_name,
                    isPreview: false,
                });
        } catch {
            if (mounted.current)
                showError(
                    '플래시카드를 열 수 없어요',
                    '잠시 후 다시 시도해주세요.',
                );
        } finally {
            if (mounted.current) setOpeningDeck(null);
        }
    };

    const resetFilters = () => {
        setFilter('all');
        setCourseFilter('all');
        setQuery('');
    };

    return (
        <main className="web-page lectures-page">
            <PageHeading
                title="동영상 강의"
                actions={
                    <>
                        <button
                            className="web-button"
                            onClick={() =>
                                navigation.navigate('FlashcardDeckList')
                            }
                        >
                            내 플래시카드
                        </button>
                        {canAutoWatch && pendingCount > 0 && (
                            <button
                                className="web-button primary"
                                disabled={watching}
                                onClick={() => {
                                    void startWatching();
                                }}
                            >
                                {watching
                                    ? '시작 중…'
                                    : `모두 자동 시청 (${pendingCount})`}
                            </button>
                        )}
                    </>
                }
            />
            <section
                className="lectures-workspace"
                aria-label="동영상 강의 목록"
            >
                <div className="lectures-toolbar">
                    <label className="lectures-search">
                        <WebIcon name="search-outline" size={18} />
                        <input
                            className="web-input"
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="강의 제목, 수업명 검색"
                            aria-label="동영상 강의 검색"
                        />
                    </label>
                    <select
                        className="web-select"
                        aria-label="수업별 필터"
                        value={courseFilter}
                        onChange={(event) =>
                            setCourseFilter(event.target.value)
                        }
                    >
                        <option value="all">모든 수업</option>
                        {courseNames.map((name) => (
                            <option value={name} key={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                    <button
                        className="web-button lectures-refresh"
                        disabled={refreshing}
                        aria-label="동영상 강의 새로고침"
                        aria-busy={refreshing}
                        onClick={() => {
                            void loadData();
                        }}
                    >
                        {refreshing ? '불러오는 중…' : '새로고침'}
                    </button>
                </div>
                <div
                    className="lectures-filters"
                    role="group"
                    aria-label="시청 상태 필터"
                >
                    {(
                        [
                            'all',
                            'available',
                            'completed',
                            'missed',
                            'upcoming',
                            'unchecked',
                        ] as const
                    ).map((value) => (
                        <button
                            className={filter === value ? 'is-active' : ''}
                            aria-pressed={filter === value}
                            key={value}
                            onClick={() => setFilter(value)}
                        >
                            {value === 'all' ? '전체' : STATUS_LABELS[value]}
                            <span>
                                {value === 'all'
                                    ? rows.length
                                    : rows.filter(
                                          (item) => item.status === value,
                                      ).length}
                            </span>
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="lectures-error" role="alert">
                        <span>강의 목록을 불러오지 못했어요.</span>
                        <button
                            className="web-button"
                            disabled={refreshing}
                            onClick={() => {
                                void loadData();
                            }}
                        >
                            다시 시도
                        </button>
                    </div>
                )}
                {loading ? (
                    <LoadingState label="강의를 불러오고 있어요" />
                ) : visibleRows.length ? (
                    <div className="lectures-table-scroll">
                        <table className="lectures-table">
                            <thead>
                                <tr>
                                    <th scope="col">강의</th>
                                    <th scope="col">시청 일정</th>
                                    <th scope="col">상태</th>
                                    <th scope="col">
                                        <span className="lectures-sr-only">
                                            시청 및 복습
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((item) => (
                                    <tr
                                        key={`${item.course_id ?? ''}:${item.id}:${item.status}`}
                                        className={`lectures-row-${item.status}`}
                                    >
                                        <td className="lectures-name-column">
                                            <div className="lectures-title-cell">
                                                <button
                                                    className="lectures-title"
                                                    aria-haspopup="dialog"
                                                    onClick={() =>
                                                        setSelected(item)
                                                    }
                                                    disabled={
                                                        item.status ===
                                                        'upcoming'
                                                    }
                                                >
                                                    {item.title}
                                                </button>
                                                {item.course_name && (
                                                    <span className="lectures-course-name">
                                                        {item.course_name}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="lectures-period-column">
                                            <LectureDeadline item={item} />
                                        </td>
                                        <td className="lectures-status-column">
                                            <span
                                                className={`lectures-status lectures-status-${item.status}`}
                                            >
                                                {STATUS_LABELS[item.status]}
                                            </span>
                                        </td>
                                        <td className="lectures-actions-column">
                                            <div className="lectures-row-actions">
                                                {item.status !== 'upcoming' ? (
                                                    <>
                                                        <button
                                                            className="lectures-row-button lectures-watch-button"
                                                            aria-label={`${item.title} 시청하기`}
                                                            onClick={() =>
                                                                openLecture(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            {item.status ===
                                                            'completed'
                                                                ? '다시 시청'
                                                                : '시청하기'}
                                                        </button>
                                                        <button
                                                            className="lectures-row-button"
                                                            aria-label={`${item.title} 텍스트·요약 보기`}
                                                            onClick={() =>
                                                                openTranscript(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            텍스트·요약
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="lectures-unavailable">
                                                        공개 후 이용 가능
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    !error && (
                        <EmptyState
                            title={
                                rows.length
                                    ? '조건에 맞는 강의가 없어요'
                                    : '아직 동영상 강의가 없어요'
                            }
                            description={
                                rows.length
                                    ? '검색어나 필터를 바꿔서 다시 찾아보세요.'
                                    : 'LearnUs에 동영상이 등록되면 여기에 표시돼요.'
                            }
                            action={
                                rows.length ? (
                                    <button
                                        className="web-button"
                                        onClick={resetFilters}
                                    >
                                        필터 초기화
                                    </button>
                                ) : undefined
                            }
                        />
                    )
                )}
                {!loading && visibleRows.length > 0 && (
                    <div className="lectures-table-footer">
                        <span aria-live="polite">
                            {visibleRows.length}개의 강의
                        </span>
                        <span>시청 기록은 LearnUs 기준으로 표시돼요.</span>
                    </div>
                )}
            </section>
            {(decks.length > 0 || deckError) && (
                <section className="lectures-decks">
                    <h2>최근 플래시카드</h2>
                    {deckError && (
                        <p role="alert">
                            플래시카드를 불러오지 못했어요. 새로고침 후 다시
                            확인해주세요.
                        </p>
                    )}
                    <div className="lectures-deck-list">
                        {decks.slice(0, 3).map((deck) => (
                            <button
                                className="lectures-deck"
                                key={deck.id}
                                aria-label={`${deck.name} 플래시카드 복습`}
                                disabled={openingDeck !== null}
                                onClick={() => {
                                    void openDeck(deck);
                                }}
                            >
                                <span>
                                    <strong>
                                        {openingDeck === deck.id
                                            ? '불러오는 중…'
                                            : deck.name}
                                    </strong>
                                    <small>
                                        {deck.course_name
                                            ? `${deck.course_name} · `
                                            : ''}
                                        {deck.card_count}장
                                    </small>
                                </span>
                                <span className="lectures-deck-open">
                                    복습하기
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}
            {selected && (
                <LectureActions
                    item={selected}
                    onClose={() => setSelected(null)}
                    onWatch={() => openLecture(selected)}
                    onTranscribe={() => openTranscript(selected)}
                    onAutoWatch={() => {
                        void startWatching(selected);
                    }}
                    autoWatchEnabled={canAutoWatch}
                />
            )}
        </main>
    );
}
