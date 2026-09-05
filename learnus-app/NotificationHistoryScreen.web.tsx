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
import {
    deleteNotificationOnServer,
    getNotificationHistoryFromServer,
    markAllNotificationsReadOnServer,
    markNotificationReadOnServer,
} from './services/api';
import type { NotificationHistoryItem } from './services/NotificationHistoryService';
import { isDemoMode } from './services/demoMode';
import './components/web/management.css';

const TYPES = {
    assignment: '과제',
    vod: '동영상',
    announcement: '공지',
    ai_summary: '공지 요약',
    transcription_complete: '텍스트 추출',
    general: '알림',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function notificationFromWire(value: unknown): NotificationHistoryItem | null {
    if (
        !isRecord(value) ||
        typeof value.id !== 'number' ||
        !Number.isInteger(value.id) ||
        value.id <= 0 ||
        typeof value.title !== 'string'
    )
        return null;
    const data = isRecord(value.data) ? value.data : {};
    const type =
        typeof value.type === 'string' && Object.hasOwn(TYPES, value.type)
            ? (value.type as keyof typeof TYPES)
            : 'general';
    return {
        id: String(value.id),
        title: value.title,
        body: typeof value.body === 'string' ? value.body : '',
        timestamp:
            typeof value.timestamp === 'number' &&
            Number.isFinite(new Date(value.timestamp).getTime())
                ? value.timestamp
                : 0,
        read: value.read === true,
        type,
        data: {
            courseId:
                typeof data.courseId === 'number' ? data.courseId : undefined,
            courseName:
                typeof data.courseName === 'string'
                    ? data.courseName
                    : undefined,
            postId: typeof data.postId === 'number' ? data.postId : undefined,
            postUrl:
                typeof data.postUrl === 'string' ? data.postUrl : undefined,
            postTitle:
                typeof data.postTitle === 'string' ? data.postTitle : undefined,
            vodMoodleId:
                typeof data.vodMoodleId === 'number'
                    ? data.vodMoodleId
                    : undefined,
            vodTitle:
                typeof data.vodTitle === 'string' ? data.vodTitle : undefined,
        },
    };
}

function timeLabel(timestamp: number): string {
    if (!timestamp) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
    if (minutes < 10080) return `${Math.floor(minutes / 1440)}일 전`;
    return new Date(timestamp).toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
    });
}

export default function NotificationHistoryScreen() {
    const navigation = useWebNavigation();
    const { showError, showInfo, showConfirm } = useToast();
    const [notifications, setNotifications] = useState<
        NotificationHistoryItem[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const [pending, setPending] = useState<Set<string>>(new Set());
    const [markingAll, setMarkingAll] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [query, setQuery] = useState('');
    const mounted = useRef(true);

    const loadNotifications = useCallback(async () => {
        setRefreshing(true);
        try {
            const result: unknown = isDemoMode()
                ? []
                : await getNotificationHistoryFromServer();
            if (!Array.isArray(result))
                throw new Error('Invalid notification list');
            const items = result
                .map(notificationFromWire)
                .filter(
                    (item): item is NotificationHistoryItem => item !== null,
                );
            if (mounted.current) {
                setNotifications(
                    items.sort((a, b) => b.timestamp - a.timestamp),
                );
                setError(false);
            }
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
            void loadNotifications();
        }, [loadNotifications]),
    );

    const sampleNotice = () =>
        showInfo('미리보기', '알림은 실제 계정을 연결하면 확인할 수 있어요.');
    const finishPending = (id: string) => {
        if (mounted.current)
            setPending((previous) => {
                const next = new Set(previous);
                next.delete(id);
                return next;
            });
    };

    const markRead = async (item: NotificationHistoryItem) => {
        if (item.read || pending.has(item.id) || markingAll || refreshing)
            return;
        if (isDemoMode()) return sampleNotice();
        setPending((previous) => new Set(previous).add(item.id));
        try {
            await markNotificationReadOnServer(Number(item.id));
            if (mounted.current)
                setNotifications((previous) =>
                    previous.map((notification) =>
                        notification.id === item.id
                            ? { ...notification, read: true }
                            : notification,
                    ),
                );
        } catch {
            if (mounted.current)
                showError('읽음 처리 실패', '잠시 후 다시 시도해주세요.');
        } finally {
            finishPending(item.id);
        }
    };

    const markAllRead = async () => {
        if (markingAll || pending.size || refreshing) return;
        if (isDemoMode()) return sampleNotice();
        setMarkingAll(true);
        try {
            await markAllNotificationsReadOnServer();
            if (mounted.current)
                setNotifications((previous) =>
                    previous.map((item) => ({ ...item, read: true })),
                );
        } catch {
            if (mounted.current)
                showError(
                    '모두 읽음 처리 실패',
                    '네트워크를 확인한 뒤 다시 시도해주세요.',
                );
        } finally {
            if (mounted.current) setMarkingAll(false);
        }
    };

    const removeNotification = async (id: string) => {
        if (pending.has(id) || markingAll || refreshing) return;
        if (isDemoMode()) return sampleNotice();
        setPending((previous) => new Set(previous).add(id));
        try {
            await deleteNotificationOnServer(Number(id));
            if (mounted.current)
                setNotifications((previous) =>
                    previous.filter((item) => item.id !== id),
                );
        } catch {
            if (mounted.current)
                showError(
                    '알림 삭제 실패',
                    '알림을 삭제하지 못했어요. 다시 시도해주세요.',
                );
        } finally {
            finishPending(id);
        }
    };

    const confirmRemove = (item: NotificationHistoryItem) => {
        if (pending.has(item.id) || markingAll || refreshing) return;
        if (isDemoMode()) return sampleNotice();
        showConfirm(
            '이 알림을 삭제할까요?',
            `“${item.title}” 알림을 삭제해요. 삭제한 알림은 복원할 수 없어요.`,
            () => {
                if (mounted.current) void removeNotification(item.id);
            },
            '삭제',
        );
    };

    const openNotification = async (item: NotificationHistoryItem) => {
        if (isDemoMode()) return sampleNotice();
        await markRead(item);
        if (!mounted.current) return;
        if (item.type === 'announcement' || item.type === 'ai_summary') {
            if (item.data?.postId || item.data?.postUrl) {
                navigation.navigate('PostDetail', {
                    postId: item.data.postId,
                    post: {
                        url: item.data.postUrl,
                        title: item.data.postTitle || '공지사항',
                    },
                });
            } else if (item.data?.courseId) {
                navigation.navigate('CourseDetail', {
                    course: {
                        id: item.data.courseId,
                        name: item.data.courseName || '강의',
                    },
                    initialTab: 'boards',
                });
            }
        } else if (
            item.type === 'transcription_complete' &&
            item.data?.vodMoodleId
        ) {
            navigation.navigate('VodTranscript', {
                vodMoodleId: item.data.vodMoodleId,
                title: item.data.vodTitle || '강의 텍스트',
                courseName: item.data.courseName || '',
            });
        }
    };

    const unreadCount = notifications.filter((item) => !item.read).length;
    const visibleNotifications = useMemo(() => {
        const term = query.trim().toLocaleLowerCase();
        return notifications.filter(
            (item) =>
                (filter === 'all' ||
                    (filter === 'unread' ? !item.read : item.read)) &&
                (typeFilter === 'all' || item.type === typeFilter) &&
                (!term ||
                    `${item.title} ${item.body} ${item.data?.courseName ?? ''}`
                        .toLocaleLowerCase()
                        .includes(term)),
        );
    }, [notifications, filter, typeFilter, query]);

    return (
        <div className="web-page management-page inbox-page">
            <PageHeading
                title="알림"
                actions={
                    <>
                        <button
                            className="web-button"
                            onClick={() =>
                                navigation.navigate('NotificationSettings')
                            }
                        >
                            알림 설정
                        </button>
                        <button
                            className="web-button"
                            disabled={
                                !unreadCount ||
                                markingAll ||
                                refreshing ||
                                pending.size > 0
                            }
                            aria-busy={markingAll}
                            onClick={() => {
                                void markAllRead();
                            }}
                        >
                            {markingAll ? '읽음 처리 중…' : '모두 읽음 처리'}
                        </button>
                    </>
                }
            />
            <div className="management-layout">
                <section
                    className="web-panel inbox-panel"
                    aria-label="알림 목록"
                >
                    <div className="management-toolbar">
                        <div
                            className="management-filters"
                            role="group"
                            aria-label="읽음 상태"
                        >
                            <button
                                className={filter === 'all' ? 'is-active' : ''}
                                aria-pressed={filter === 'all'}
                                onClick={() => setFilter('all')}
                            >
                                전체<span>{notifications.length}</span>
                            </button>
                            <button
                                className={
                                    filter === 'unread' ? 'is-active' : ''
                                }
                                aria-pressed={filter === 'unread'}
                                onClick={() => setFilter('unread')}
                            >
                                안 읽음<span>{unreadCount}</span>
                            </button>
                            <button
                                className={filter === 'read' ? 'is-active' : ''}
                                aria-pressed={filter === 'read'}
                                onClick={() => setFilter('read')}
                            >
                                읽음
                                <span>
                                    {notifications.length - unreadCount}
                                </span>
                            </button>
                        </div>
                        <button
                            className="web-icon-button"
                            aria-label="알림 새로고침"
                            aria-busy={refreshing}
                            disabled={
                                refreshing || markingAll || pending.size > 0
                            }
                            onClick={() => {
                                void loadNotifications();
                            }}
                        >
                            <WebIcon name="refresh-outline" size={18} />
                        </button>
                    </div>
                    <div className="inbox-search-row">
                        <label className="management-search">
                            <input
                                className="web-input"
                                type="search"
                                placeholder="제목, 내용 또는 강의명 검색"
                                aria-label="알림 제목 또는 내용 검색"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                        </label>
                        <select
                            className="web-select"
                            aria-label="알림 종류"
                            value={typeFilter}
                            onChange={(event) =>
                                setTypeFilter(event.target.value)
                            }
                        >
                            <option value="all">모든 종류</option>
                            {Object.entries(TYPES).map(([type, label]) => (
                                <option value={type} key={type}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {error && (
                        <div className="management-error" role="alert">
                            <span>
                                알림을 불러오지 못했어요. 연결 상태를
                                확인해주세요.
                            </span>
                            <button
                                className="web-button"
                                disabled={refreshing}
                                onClick={() => {
                                    void loadNotifications();
                                }}
                            >
                                다시 시도
                            </button>
                        </div>
                    )}
                    {loading ? (
                        <LoadingState label="새로운 소식을 확인하고 있어요" />
                    ) : visibleNotifications.length ? (
                        <ul className="inbox-list">
                            {visibleNotifications.map((item) => {
                                const busy =
                                    pending.has(item.id) ||
                                    markingAll ||
                                    refreshing;
                                const linked =
                                    ((item.type === 'announcement' ||
                                        item.type === 'ai_summary') &&
                                        (item.data?.postId ||
                                            item.data?.postUrl ||
                                            item.data?.courseId)) ||
                                    (item.type === 'transcription_complete' &&
                                        item.data?.vodMoodleId);
                                return (
                                    <li
                                        key={item.id}
                                        className={`${item.read ? '' : 'is-unread'} inbox-type-${item.type}`}
                                    >
                                        <button
                                            className="inbox-notification"
                                            disabled={busy}
                                            onClick={() => {
                                                void openNotification(item);
                                            }}
                                            aria-label={`${item.read ? '' : '읽지 않은 알림: '}${item.title}${linked ? ', 상세 보기' : ''}`}
                                        >
                                            <span className="inbox-content">
                                                <span className="inbox-meta">
                                                    <span
                                                        className={`inbox-read-state${item.read ? '' : ' is-unread'}`}
                                                    >
                                                        {item.read
                                                            ? '읽음'
                                                            : '안 읽음'}
                                                    </span>
                                                    <span className="inbox-type-label">
                                                        {TYPES[item.type]}
                                                    </span>
                                                    {item.data?.courseName && (
                                                        <span className="inbox-course-name">
                                                            {
                                                                item.data
                                                                    .courseName
                                                            }
                                                        </span>
                                                    )}
                                                    <time
                                                        dateTime={
                                                            item.timestamp
                                                                ? new Date(
                                                                      item.timestamp,
                                                                  ).toISOString()
                                                                : undefined
                                                        }
                                                        title={
                                                            item.timestamp
                                                                ? new Date(
                                                                      item.timestamp,
                                                                  ).toLocaleString(
                                                                      'ko-KR',
                                                                  )
                                                                : undefined
                                                        }
                                                    >
                                                        {timeLabel(
                                                            item.timestamp,
                                                        )}
                                                    </time>
                                                </span>
                                                <strong>{item.title}</strong>
                                                <span className="inbox-body">
                                                    {item.body}
                                                </span>
                                            </span>
                                            {linked && (
                                                <WebIcon
                                                    name="chevron-forward"
                                                    size={16}
                                                />
                                            )}
                                        </button>
                                        <div className="inbox-item-actions">
                                            {!item.read && (
                                                <button
                                                    className="inbox-mark-read"
                                                    disabled={busy}
                                                    aria-label={`${item.title} 읽음 처리`}
                                                    onClick={() => {
                                                        void markRead(item);
                                                    }}
                                                >
                                                    읽음 처리
                                                </button>
                                            )}
                                            <button
                                                className="web-icon-button inbox-delete"
                                                disabled={busy}
                                                title="알림 삭제"
                                                aria-label={`${item.title} 삭제`}
                                                onClick={() =>
                                                    confirmRemove(item)
                                                }
                                            >
                                                <WebIcon
                                                    name="trash-outline"
                                                    size={17}
                                                />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        !error && (
                            <EmptyState
                                title={
                                    notifications.length
                                        ? filter === 'unread' &&
                                          !query &&
                                          typeFilter === 'all'
                                            ? '모든 알림을 확인했어요'
                                            : '조건에 맞는 알림이 없어요'
                                        : '아직 도착한 알림이 없어요'
                                }
                                description={
                                    notifications.length
                                        ? '필터나 검색어를 바꿔 보세요.'
                                        : '새 알림이 도착하면 여기에 표시돼요.'
                                }
                                action={
                                    notifications.length ? (
                                        <button
                                            className="web-button"
                                            onClick={() => {
                                                setQuery('');
                                                setFilter('all');
                                                setTypeFilter('all');
                                            }}
                                        >
                                            전체 알림 보기
                                        </button>
                                    ) : undefined
                                }
                            />
                        )
                    )}
                    {!loading && (
                        <div className="management-list-footer">
                            <span>{visibleNotifications.length}개의 알림</span>
                            <span>최근 알림 100개까지 표시돼요</span>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
