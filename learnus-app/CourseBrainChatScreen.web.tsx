import React, {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import Markdown, { type RenderRules } from 'react-native-markdown-display';
import axios from 'axios';
import { createMarkdownStyles } from './AIChatModal';
import { useAuth } from './context/AuthContext';
import { useLabs } from './context/LabsContext';
import { useTheme } from './context/ThemeContext';
import { useToast } from './context/ToastContext';
import {
    EmptyState,
    LoadingState,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import {
    chatWithCourseBrain,
    filePageSource,
    getCourseLibrary,
    getLibraryItem,
} from './services/api';
import type {
    BrainCitation,
    CourseLibrary,
    LibraryItem,
    LibraryItemDetail,
} from './services/api';
import { isDemoMode } from './services/demoMode';
import { weekLabelKo } from './utils/week';
import './components/web/brain-chat.css';

interface Turn {
    role: 'user' | 'assistant';
    text: string;
    citations?: BrainCitation[];
    state?: 'streaming' | 'done' | 'stopped' | 'error';
    error?: string;
}

type AnswerSegment =
    | { kind: 'text'; text: string }
    | { kind: 'slide'; ref: string; page: number }
    | { kind: 'vod'; ref: string; seconds: number; label: string };

interface OpenSource {
    key: string;
    citation: BrainCitation;
    detail?: LibraryItemDetail;
    page: number;
    loading: boolean;
    error?: string;
}

const EMBED_PATTERN =
    /\[\[slide:(S\d+):(\d+)\]\]|\[\[vod:(S\d+)@(\d{1,2}):(\d{2})(?::(\d{2}))?\]\]/g;

function safeUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) &&
            !url.username &&
            !url.password
            ? url.href
            : null;
    } catch {
        return null;
    }
}

const markdownRules: RenderRules = {
    link: (node, children) => {
        const href = safeUrl(node.attributes.href);
        return href ? (
            <a
                key={node.key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
            >
                {children}
            </a>
        ) : (
            <span key={node.key}>{children}</span>
        );
    },
    blocklink: (node, children) => {
        const href = safeUrl(node.attributes.href);
        return href ? (
            <a
                key={node.key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
            >
                {children}
            </a>
        ) : (
            <span key={node.key}>{children}</span>
        );
    },
    // Model-authored images stay explicit links; only verified course PDF pages load inline.
    image: (node) => {
        const href = safeUrl(node.attributes.src);
        const label = node.content || '이미지 열기';
        return href ? (
            <a
                key={node.key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
            >
                {label}
            </a>
        ) : (
            <span key={node.key}>{label}</span>
        );
    },
};

function splitAnswer(text: string): AnswerSegment[] {
    const segments: AnswerSegment[] = [];
    let last = 0;
    for (const match of text.matchAll(EMBED_PATTERN)) {
        const index = match.index ?? 0;
        if (index > last)
            segments.push({ kind: 'text', text: text.slice(last, index) });
        if (match[1]) {
            segments.push({
                kind: 'slide',
                ref: match[1],
                page: Number(match[2]),
            });
        } else {
            const seconds =
                match[6] === undefined
                    ? Number(match[4]) * 60 + Number(match[5])
                    : Number(match[4]) * 3600 +
                      Number(match[5]) * 60 +
                      Number(match[6]);
            const label =
                match[6] === undefined
                    ? `${match[4]}:${match[5]}`
                    : `${match[4]}:${match[5]}:${match[6]}`;
            segments.push({ kind: 'vod', ref: match[3], seconds, label });
        }
        last = index + match[0].length;
    }
    if (last < text.length)
        segments.push({ kind: 'text', text: text.slice(last) });
    return segments;
}

function PagePreview({
    fileId,
    page,
    title,
    onOpen,
}: {
    fileId: number;
    page: number;
    title: string;
    onOpen: () => void;
}) {
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        setFailed(false);
        setLoaded(false);
    }, [fileId, page]);
    return (
        <figure className="brain-chat-page-preview">
            {!failed && (
                <img
                    src={filePageSource(fileId, page).uri}
                    alt={`${title} ${page}쪽`}
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                />
            )}
            {!loaded && (
                <p role="status">
                    {failed
                        ? '페이지를 불러오지 못했어요. 자료에서 다시 확인해주세요.'
                        : '페이지를 불러오는 중…'}
                </p>
            )}
            <figcaption>
                <span>
                    {title} · {page}쪽
                </span>
                <button
                    type="button"
                    className="brain-chat-text-button"
                    onClick={onOpen}
                >
                    자료 열기
                </button>
            </figcaption>
        </figure>
    );
}

export default function CourseBrainChatScreen() {
    const route = useRoute();
    const { courseId, courseName } = route.params as {
        courseId: number;
        courseName?: string;
    };
    const navigation = useWebNavigation();
    const questionId = useId();
    const inputHelpId = useId();
    const { isLoggedIn } = useAuth();
    const {
        labsUnlocked,
        brainEnabled,
        isLoading: labsLoading,
        refreshLabs,
    } = useLabs();
    const { colors, isDark } = useTheme();
    const { showConfirm } = useToast();
    const demo = isDemoMode();
    const allowed = isLoggedIn && labsUnlocked && brainEnabled && !demo;
    const [library, setLibrary] = useState<CourseLibrary | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [source, setSource] = useState<OpenSource | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const cancelRef = useRef<(() => void) | null>(null);
    const loadTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const streamTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const streamId = useRef(0);
    const loadId = useRef(0);
    const sourceId = useRef(0);
    const active = useRef(false);
    const composing = useRef(false);
    const followEnd = useRef(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const markdownStyles = useMemo(
        () => ({
            ...createMarkdownStyles(colors, isDark),
            body: { color: colors.textPrimary, fontSize: 15, lineHeight: 26 },
        }),
        [colors, isDark],
    );
    const items = useMemo(
        () => library?.sections.flatMap((section) => section.items) ?? [],
        [library],
    );
    const itemFor = (citation: BrainCitation) =>
        items.find(
            (item) => item.type === citation.type && item.id === citation.id,
        );
    const canSend =
        allowed &&
        !loading &&
        !loadError &&
        !!library?.brain.enabled &&
        library.stats.corpus_chars > 0;

    const stop = useCallback(() => {
        streamId.current += 1;
        if (streamTimeout.current) clearTimeout(streamTimeout.current);
        streamTimeout.current = null;
        cancelRef.current?.();
        cancelRef.current = null;
        setStreaming(false);
        setTurns((previous) =>
            previous.map((turn) =>
                turn.state === 'streaming'
                    ? { ...turn, state: 'stopped' }
                    : turn,
            ),
        );
    }, []);

    const loadLibrary = useCallback(async () => {
        if (!allowed) {
            setLoading(false);
            return;
        }
        const requestId = ++loadId.current;
        setLoading(true);
        setLoadError('');
        const timeout = setTimeout(() => {
            if (!active.current || requestId !== loadId.current) return;
            loadId.current += 1;
            setLoadError(
                '응답이 늦어지고 있어요. 연결 상태를 확인하고 다시 시도해주세요.',
            );
            setLoading(false);
        }, 20000);
        loadTimeout.current = timeout;
        try {
            const next = await getCourseLibrary(courseId);
            if (active.current && requestId === loadId.current)
                setLibrary(next);
        } catch (error) {
            if (!active.current || requestId !== loadId.current) return;
            const status = axios.isAxiosError(error)
                ? error.response?.status
                : undefined;
            setLoadError(
                status === 401
                    ? '로그인 세션이 만료됐어요. 다시 로그인해주세요.'
                    : status === 403
                      ? '이 과목의 브레인에 접근할 권한이 없어요. 실험실 설정을 확인해주세요.'
                      : status === 404
                        ? '이 강의를 찾을 수 없어요.'
                        : '강의 자료를 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.',
            );
        } finally {
            clearTimeout(timeout);
            if (loadTimeout.current === timeout) loadTimeout.current = null;
            if (active.current && requestId === loadId.current)
                setLoading(false);
        }
    }, [allowed, courseId]);

    useFocusEffect(
        useCallback(() => {
            active.current = true;
            void loadLibrary();
            return () => {
                active.current = false;
                loadId.current += 1;
                sourceId.current += 1;
                setSource(null);
                if (loadTimeout.current) clearTimeout(loadTimeout.current);
                loadTimeout.current = null;
                stop();
            };
        }, [loadLibrary, stop]),
    );

    useEffect(() => {
        setTurns([]);
        setInput('');
        setSource(null);
        setLibrary(null);
    }, [courseId]);

    useEffect(() => {
        if (followEnd.current && scrollRef.current)
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [turns, source]);

    const suggestions = useMemo(() => {
        if (!library) return [];
        const examples: string[] = [];
        const week = library.sections.find(
            (section) =>
                section.section && section.items.some((item) => item.in_corpus),
        );
        if (week)
            examples.push(
                `${weekLabelKo(week.week)}의 핵심 개념을 정리해주세요.`,
            );
        const assignment = items.find(
            (item) => item.type === 'assignment' && item.in_corpus,
        );
        if (assignment)
            examples.push(`${assignment.title}에 무엇을 제출해야 하나요?`);
        examples.push('이 과목의 평가 방식이 어떻게 되나요?');
        return examples.slice(0, 3);
    }, [library, items]);

    const send = () => {
        const question = input.trim();
        if (!question || !canSend || streaming || cancelRef.current) return;
        const history = turns.filter((turn, index) =>
            turn.role === 'assistant'
                ? turn.state === 'done'
                : turns[index + 1]?.state === 'done',
        );
        const requestId = ++streamId.current;
        setTurns((previous) => [
            ...previous,
            { role: 'user', text: question },
            { role: 'assistant', text: '', state: 'streaming' },
        ]);
        setInput('');
        setStreaming(true);
        setAnnouncement('답변을 작성하고 있어요.');
        followEnd.current = true;
        let settled = false;
        const current = () =>
            !settled && active.current && requestId === streamId.current;
        const updateAnswer = (update: (turn: Turn) => Turn) =>
            setTurns((previous) =>
                previous.map((turn, index) =>
                    index === previous.length - 1 ? update(turn) : turn,
                ),
            );
        const finish = () => {
            settled = true;
            if (streamTimeout.current) clearTimeout(streamTimeout.current);
            streamTimeout.current = null;
            cancelRef.current = null;
            setStreaming(false);
        };
        const restartTimeout = () => {
            if (streamTimeout.current) clearTimeout(streamTimeout.current);
            streamTimeout.current = setTimeout(() => {
                if (!current()) return;
                cancelRef.current?.();
                updateAnswer((turn) => ({
                    ...turn,
                    state: 'error',
                    error: '응답이 늦어져 연결을 중단했어요. 잠시 후 다시 시도해주세요.',
                }));
                finish();
                setAnnouncement('응답 시간이 초과됐어요.');
            }, 45000);
        };
        try {
            restartTimeout();
            const cancel = chatWithCourseBrain(
                courseId,
                [
                    ...history.map((turn) => ({
                        role: turn.role,
                        content: turn.text,
                    })),
                    { role: 'user', content: question },
                ],
                {
                    onToken: (token) => {
                        if (current()) {
                            restartTimeout();
                            updateAnswer((turn) => ({
                                ...turn,
                                text: turn.text + token,
                            }));
                        }
                    },
                    onDone: (citations) => {
                        if (!current()) return;
                        updateAnswer((turn) => ({
                            ...turn,
                            state: 'done',
                            citations: citations.filter(
                                (citation) =>
                                    /^S\d+$/.test(citation.ref) &&
                                    items.some(
                                        (item) =>
                                            item.type === citation.type &&
                                            item.id === citation.id,
                                    ),
                            ),
                        }));
                        finish();
                        setAnnouncement(
                            '답변이 완료됐어요. 출처를 확인할 수 있어요.',
                        );
                    },
                    onError: (error) => {
                        if (!current()) return;
                        updateAnswer((turn) => ({
                            ...turn,
                            state: 'error',
                            error,
                        }));
                        finish();
                        setAnnouncement('답변을 완료하지 못했어요.');
                    },
                },
            );
            // A synchronous boundary failure must not leave a stale cancellation handle.
            if (!settled && requestId === streamId.current)
                cancelRef.current = cancel;
        } catch {
            updateAnswer((turn) => ({
                ...turn,
                state: 'error',
                error: '연결을 시작하지 못했어요. 다시 시도해주세요.',
            }));
            finish();
            setAnnouncement('답변을 완료하지 못했어요.');
        }
    };

    const openItem = (item: LibraryItem, page?: number) =>
        navigation.navigate('LibraryItem', {
            item,
            courseId,
            courseName,
            ...(page ? { initialPage: page } : {}),
        });
    const selectSource = async (
        citation: BrainCitation,
        answer: string,
        index: number,
    ) => {
        const key = `${index}-${citation.ref}`;
        const requestId = ++sourceId.current;
        if (source?.key === key) {
            setSource(null);
            return;
        }
        setSource({ key, citation, page: 1, loading: true });
        try {
            const detail = await getLibraryItem(
                courseId,
                citation.type,
                citation.id,
            );
            if (!active.current || requestId !== sourceId.current) return;
            const near =
                answer.match(
                    new RegExp(`\\[${citation.ref}\\]\\s*\\[p\\.(\\d+)\\]`),
                ) ||
                answer.match(
                    new RegExp(`\\[\\[slide:${citation.ref}:(\\d+)\\]\\]`),
                ) ||
                answer.match(/\[p\.(\d+)\]/);
            const page = Math.max(
                1,
                Math.min(Number(near?.[1] || 1), detail.pages || 1),
            );
            setSource({ key, citation, detail, page, loading: false });
        } catch {
            if (active.current && requestId === sourceId.current)
                setSource({
                    key,
                    citation,
                    page: 1,
                    loading: false,
                    error: '출처를 불러오지 못했어요. 자료에서 다시 확인해주세요.',
                });
        }
    };

    const renderAnswer = (turn: Turn) => {
        const text = turn.text
            .replace(/\[S\d+\]/g, '')
            .replace(/ +([.,])/g, '$1');
        const segments =
            turn.state === 'streaming'
                ? [
                      {
                          kind: 'text' as const,
                          text: text
                              .replace(EMBED_PATTERN, '')
                              .replace(/\[\[(?:slide|vod):[^\]]*$/, ''),
                      },
                  ]
                : splitAnswer(text);
        return segments.map((segment, index) => {
            if (segment.kind === 'text')
                return segment.text.trim() ? (
                    <Markdown
                        key={index}
                        rules={markdownRules}
                        style={markdownStyles}
                    >
                        {segment.text}
                    </Markdown>
                ) : null;
            const citation = turn.citations?.find(
                (entry) => entry.ref === segment.ref,
            );
            const item = citation && itemFor(citation);
            if (!citation || !item) return null;
            if (
                segment.kind === 'slide' &&
                item.type === 'file' &&
                item.kind === 'pdf'
            ) {
                const page = Math.max(
                    1,
                    Math.min(segment.page, item.pages || 1),
                );
                return (
                    <PagePreview
                        key={index}
                        fileId={item.id}
                        page={page}
                        title={item.title}
                        onOpen={() => openItem(item, page)}
                    />
                );
            }
            if (segment.kind === 'vod' && item.type === 'vod') {
                const href =
                    safeUrl(item.url) ||
                    (Number.isSafeInteger(item.moodle_id) && item.moodle_id > 0
                        ? `https://ys.learnus.org/mod/vod/viewer.php?id=${item.moodle_id}`
                        : null);
                if (!href)
                    return (
                        <button
                            key={index}
                            className="brain-chat-text-button"
                            onClick={() => openItem(item)}
                        >
                            {item.title} · {segment.label} 내용 보기
                        </button>
                    );
                const url = new URL(href);
                url.hash = `t=${segment.seconds}`;
                return (
                    <a
                        key={index}
                        className="brain-chat-video"
                        href={url.href}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <WebIcon name="play-outline" size={18} />
                        <span>
                            <strong>{item.title}</strong>
                            <span>{segment.label} 구간 · LearnUs에서 열기</span>
                        </span>
                    </a>
                );
            }
            return null;
        });
    };

    let notice = '';
    if (demo)
        notice =
            '미리보기에서는 AI 채팅을 사용할 수 없어요. 로그인 후 실제 강의에서 이용해주세요.';
    else if (!isLoggedIn) notice = '로그인 후 강의 브레인을 이용할 수 있어요.';
    else if (!labsLoading && !labsUnlocked)
        notice = '이 계정은 실험실 기능에 접근할 수 없어요.';
    else if (!labsLoading && !brainEnabled)
        notice = '실험실에서 강의 브레인을 켠 뒤 이용해주세요.';
    else if (loadError) notice = loadError;
    else if (library && !library.brain.enabled)
        notice =
            '이 과목의 브레인이 꺼져 있어요. 브레인 설정에서 학습할 자료를 선택해주세요.';
    else if (library && !library.stats.corpus_chars)
        notice =
            library.brain.status === 'queued' ||
            library.brain.status === 'building'
                ? '강의 자료를 학습하고 있어요. 첫 자료의 학습이 끝나면 질문할 수 있어요.'
                : library.brain.status === 'error'
                  ? '자료 학습을 완료하지 못했어요. 브레인 설정에서 학습 상태를 확인해주세요.'
                  : '아직 학습된 자료가 없어요. 강의 자료에서 학습할 항목을 선택해주세요.';
    const courseTitle = library?.course.name || courseName || '강의';
    const learning =
        library?.brain.status === 'queued' ||
        library?.brain.status === 'building';
    const showLoading = labsLoading || (allowed && loading);

    return (
        <section
            className="brain-chat-screen"
            aria-label={`${courseTitle} 브레인 채팅`}
        >
            <header className="brain-chat-header">
                <div className="brain-chat-course">
                    <button
                        className="web-icon-button"
                        aria-label="이전 화면"
                        onClick={() => navigation.goBack()}
                    >
                        <WebIcon name="arrow-back" size={20} />
                    </button>
                    <div>
                        <h1>브레인 채팅</h1>
                        <p>{courseTitle}</p>
                    </div>
                </div>
                <div className="brain-chat-header-actions">
                    {allowed && (
                        <button
                            className="web-button"
                            onClick={() =>
                                navigation.navigate('CourseLibrary', {
                                    courseId,
                                    courseName: courseTitle,
                                })
                            }
                        >
                            강의 자료
                        </button>
                    )}
                    <button
                        className="web-button"
                        disabled={!turns.length}
                        onClick={() =>
                            showConfirm(
                                '새 대화를 시작할까요?',
                                '현재 대화는 저장되지 않으며, 작성 중인 답변도 중단돼요.',
                                () => {
                                    stop();
                                    setTurns([]);
                                    sourceId.current += 1;
                                    setSource(null);
                                    setInput('');
                                    setAnnouncement('새 대화를 시작했어요.');
                                    inputRef.current?.focus();
                                },
                                '새 대화',
                            )
                        }
                    >
                        새 대화
                    </button>
                </div>
            </header>
            {library && allowed && (
                <div className="brain-chat-context">
                    <span>학습된 자료 {library.stats.in_corpus}개 기준</span>
                    <span>
                        {learning
                            ? `추가 자료 학습 중 · ${Math.round(library.brain.progress)}%`
                            : library.brain.status === 'error'
                              ? '일부 자료 학습 오류 · 학습된 내용으로 답변'
                              : `자료 ${library.stats.files} · 강의 ${library.stats.vods} · 과제 ${library.stats.assignments} · 공지 ${library.stats.posts}`}
                    </span>
                </div>
            )}
            <div
                className="brain-chat-scroll"
                ref={scrollRef}
                onScroll={(event) => {
                    const element = event.currentTarget;
                    followEnd.current =
                        element.scrollHeight -
                            element.scrollTop -
                            element.clientHeight <
                        100;
                }}
            >
                <div className="brain-chat-thread">
                    {showLoading ? (
                        <LoadingState label="강의 브레인 상태를 확인하고 있어요" />
                    ) : notice ? (
                        <EmptyState
                            title="브레인 채팅을 준비해주세요"
                            description={notice}
                            action={
                                <div className="brain-chat-state-actions">
                                    {allowed && (
                                        <button
                                            className="web-button"
                                            onClick={() => void loadLibrary()}
                                        >
                                            상태 새로고침
                                        </button>
                                    )}
                                    {isLoggedIn && labsUnlocked && !demo && (
                                        <button
                                            className="web-button primary"
                                            onClick={() =>
                                                navigation.navigate(
                                                    brainEnabled
                                                        ? 'BrainSettings'
                                                        : 'Labs',
                                                )
                                            }
                                        >
                                            {brainEnabled
                                                ? '브레인 설정'
                                                : '실험실 설정'}
                                        </button>
                                    )}
                                    {isLoggedIn && !labsUnlocked && !demo && (
                                        <button
                                            className="web-button"
                                            onClick={() => void refreshLabs()}
                                        >
                                            접근 상태 새로고침
                                        </button>
                                    )}
                                </div>
                            }
                        />
                    ) : (
                        !turns.length && (
                            <div className="brain-chat-welcome">
                                <h2>이 과목에 대해 질문해보세요</h2>
                                <p>
                                    학습된 강의·자료·공지에서 답을 찾고, 확인할
                                    수 있는 출처를 함께 보여드려요.
                                </p>
                                <div className="brain-chat-suggestions">
                                    {suggestions.map((question) => (
                                        <button
                                            key={question}
                                            onClick={() => {
                                                setInput(question);
                                                inputRef.current?.focus();
                                            }}
                                        >
                                            {question}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                    )}
                    {!notice &&
                        !showLoading &&
                        turns.map((turn, index) => (
                            <article
                                className={`brain-chat-turn brain-chat-turn-${turn.role}`}
                                key={index}
                                aria-label={
                                    turn.role === 'user'
                                        ? '내 질문'
                                        : '브레인 답변'
                                }
                            >
                                <h2>
                                    {turn.role === 'user' ? '나' : '브레인'}
                                </h2>
                                {turn.role === 'user' ? (
                                    <p className="brain-chat-question">
                                        {turn.text}
                                    </p>
                                ) : (
                                    <div className="brain-chat-answer">
                                        {renderAnswer(turn)}
                                        {turn.state === 'streaming' && (
                                            <p className="brain-chat-response-status">
                                                답변 작성 중…
                                            </p>
                                        )}
                                        {turn.state === 'stopped' && (
                                            <p className="brain-chat-response-status">
                                                답변 생성을 중단했어요.
                                            </p>
                                        )}
                                        {turn.state === 'error' && (
                                            <div
                                                className="brain-chat-error"
                                                role="alert"
                                            >
                                                <p>
                                                    {turn.error ||
                                                        '답변을 완료하지 못했어요.'}
                                                </p>
                                                <button
                                                    className="brain-chat-text-button"
                                                    onClick={() => {
                                                        setInput(
                                                            turns[index - 1]
                                                                ?.text || '',
                                                        );
                                                        inputRef.current?.focus();
                                                    }}
                                                >
                                                    질문 다시 작성
                                                </button>
                                            </div>
                                        )}
                                        {!!turn.citations?.length && (
                                            <div className="brain-chat-sources">
                                                <h3>출처</h3>
                                                {turn.citations.map(
                                                    (citation) => (
                                                        <button
                                                            key={citation.ref}
                                                            aria-expanded={
                                                                source?.key ===
                                                                `${index}-${citation.ref}`
                                                            }
                                                            onClick={() =>
                                                                void selectSource(
                                                                    citation,
                                                                    turn.text,
                                                                    index,
                                                                )
                                                            }
                                                        >
                                                            {citation.title}
                                                            {citation.week
                                                                ? ` · ${weekLabelKo(citation.week)}`
                                                                : ''}
                                                        </button>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                        {source?.key.startsWith(
                                            `${index}-`,
                                        ) && (
                                            <div className="brain-chat-source-detail">
                                                {source.loading ? (
                                                    <LoadingState label="출처를 불러오고 있어요" />
                                                ) : source.error ? (
                                                    <p role="alert">
                                                        {source.error}
                                                    </p>
                                                ) : source.detail?.kind ===
                                                  'pdf' ? (
                                                    <PagePreview
                                                        fileId={
                                                            source.citation.id
                                                        }
                                                        page={source.page}
                                                        title={
                                                            source.citation
                                                                .title
                                                        }
                                                        onOpen={() => {
                                                            const item =
                                                                itemFor(
                                                                    source.citation,
                                                                );
                                                            if (item)
                                                                openItem(
                                                                    item,
                                                                    source.page,
                                                                );
                                                        }}
                                                    />
                                                ) : (
                                                    <p>
                                                        {source.detail
                                                            ?.summary ||
                                                            source.detail?.content?.slice(
                                                                0,
                                                                400,
                                                            ) ||
                                                            '원문 자료에서 내용을 확인할 수 있어요.'}
                                                    </p>
                                                )}
                                                {source.detail?.kind !==
                                                    'pdf' && (
                                                    <button
                                                        className="brain-chat-text-button"
                                                        onClick={() => {
                                                            const item =
                                                                itemFor(
                                                                    source.citation,
                                                                );
                                                            if (item)
                                                                openItem(item);
                                                        }}
                                                    >
                                                        자료 자세히 보기
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        ))}
                </div>
            </div>
            <footer className="brain-chat-composer">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        send();
                    }}
                >
                    <label htmlFor={questionId}>{courseTitle}에 질문하기</label>
                    <div className="brain-chat-input-row">
                        <textarea
                            id={questionId}
                            ref={inputRef}
                            rows={2}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            disabled={!canSend}
                            placeholder={
                                canSend
                                    ? '궁금한 내용이나 확인할 자료를 입력하세요'
                                    : '브레인이 준비되면 질문할 수 있어요'
                            }
                            aria-describedby={inputHelpId}
                            onCompositionStart={() => {
                                composing.current = true;
                            }}
                            onCompositionEnd={() => {
                                composing.current = false;
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.key === 'Enter' &&
                                    !event.shiftKey &&
                                    !event.nativeEvent.isComposing &&
                                    !composing.current &&
                                    event.keyCode !== 229
                                ) {
                                    event.preventDefault();
                                    send();
                                }
                            }}
                        />
                        {streaming ? (
                            <button
                                type="button"
                                className="web-button"
                                onClick={() => {
                                    stop();
                                    setAnnouncement('답변 생성을 중단했어요.');
                                }}
                            >
                                답변 중단
                            </button>
                        ) : (
                            <button
                                type="submit"
                                className="web-button primary"
                                disabled={!canSend || !input.trim()}
                            >
                                보내기
                            </button>
                        )}
                    </div>
                    <div className="brain-chat-input-help" id={inputHelpId}>
                        <span>Enter로 전송 · Shift+Enter로 줄바꿈</span>
                        <span>중요한 내용은 출처에서 확인해주세요.</span>
                    </div>
                </form>
            </footer>
            <span
                className="brain-chat-announcement"
                role="status"
                aria-live="polite"
            >
                {announcement}
            </span>
        </section>
    );
}
