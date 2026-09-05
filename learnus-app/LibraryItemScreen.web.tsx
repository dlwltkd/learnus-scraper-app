import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import axios from 'axios';
import { useLabs } from './context/LabsContext';
import { useTheme } from './context/ThemeContext';
import { useToast } from './context/ToastContext';
import { useAuth } from './context/AuthContext';
import { isDemoMode } from './services/demoMode';
import {
    brainRequestError,
    useBrainPageActive,
} from './components/CourseBrainToggle.web';
import LinkedText from './components/LinkedText';
import {
    filePageSource,
    getCourseLibrary,
    getLibraryItem,
    learnLibraryItem,
    type CourseLibrary,
    type LibraryItem,
    type LibraryItemDetail,
} from './services/api';
import {
    EmptyState,
    LoadingState,
    PageHeading,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import {
    isLearnable,
    libraryItemState,
    libraryStateLabels,
    libraryTypeLabels,
} from './CourseLibraryScreen.web';
import { shortenWeek } from './utils/week';
import './components/web/library.css';

function sourceUrl(value?: string | null): string | undefined {
    if (!value) return undefined;
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:') &&
            !url.username &&
            !url.password
            ? url.href
            : undefined;
    } catch {
        return undefined;
    }
}

export default function LibraryItemScreen() {
    const { params } = useRoute();
    const { item, courseId, courseName, initialPage } = params as {
        item: LibraryItem;
        courseId: number;
        courseName?: string;
        initialPage?: number;
    };
    const navigation = useWebNavigation();
    const { colors } = useTheme();
    const { labsUnlocked, brainEnabled, isLoading: labsLoading } = useLabs();
    const { showConfirm, showError } = useToast();
    const { isLoggedIn } = useAuth();
    const activePage = useBrainPageActive();
    const allowed = isLoggedIn && labsUnlocked && brainEnabled && !isDemoMode();
    const [detail, setDetail] = useState<LibraryItemDetail | null>(null);
    const [library, setLibrary] = useState<CourseLibrary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [forbidden, setForbidden] = useState(false);
    const [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(false);
    const [page, setPage] = useState(1);
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState(false);
    const [imageRevision, setImageRevision] = useState(0);
    const [readerTab, setReaderTab] = useState<'pages' | 'text'>('pages');
    const mounted = useRef(false);
    const submitting = useRef(false);
    const initialPageApplied = useRef(false);
    const canWrite = useRef(false);
    canWrite.current = allowed && !forbidden && activePage;

    useEffect(() => {
        setDetail(null);
        setLibrary(null);
        setLoading(true);
        setPage(1);
        setReaderTab('pages');
        initialPageApplied.current = false;
    }, [courseId, item.type, item.id, initialPage]);

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
                const [nextDetail, nextLibrary] = await Promise.all([
                    getLibraryItem(courseId, item.type, item.id),
                    getCourseLibrary(courseId),
                ]);
                if (!active) return;
                setDetail(nextDetail);
                setLibrary(nextLibrary);
                setError('');
                setForbidden(false);
                const current = nextLibrary.sections
                    .flatMap((section) => section.items)
                    .find(
                        (candidate) =>
                            candidate.type === item.type &&
                            candidate.id === item.id,
                    );
                if (
                    nextLibrary.brain.status === 'queued' ||
                    nextLibrary.brain.status === 'building' ||
                    (current && libraryItemState(current) === 'learning')
                )
                    timer = setTimeout(load, 5000);
            } catch (reason) {
                if (!active) return;
                const status = axios.isAxiosError(reason)
                    ? reason.response?.status
                    : undefined;
                setForbidden(status === 403);
                setError(
                    status === 404
                        ? '이 자료를 찾을 수 없어요. 자료 목록에서 다시 확인해 주세요.'
                        : '자료 내용을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
                );
            } finally {
                if (active) setLoading(false);
            }
        };
        void load();
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [
        allowed,
        activePage,
        courseId,
        item.type,
        item.id,
        initialPage,
        revision,
    ]);

    const currentItem =
        library?.sections
            .flatMap((section) => section.items)
            .find(
                (candidate) =>
                    candidate.type === item.type && candidate.id === item.id,
            ) || item;
    const state = libraryItemState(currentItem);
    const pageCount = Math.max(0, Math.floor(detail?.pages ?? item.pages ?? 0));
    const isPdf =
        item.type === 'file' &&
        (detail?.kind ?? item.kind) === 'pdf' &&
        pageCount > 0;
    const originalUrl = sourceUrl(detail?.url || item.url);
    const canChat = !!library?.brain.enabled;
    const title = library?.course.name || courseName || '강의';

    useEffect(() => {
        if (!detail || !pageCount) return;
        if (!initialPageApplied.current) {
            const requested =
                typeof initialPage === 'number' && Number.isFinite(initialPage)
                    ? Math.floor(initialPage)
                    : 1;
            setPage(Math.max(1, Math.min(pageCount, requested)));
            initialPageApplied.current = true;
        } else
            setPage((previous) => Math.max(1, Math.min(pageCount, previous)));
    }, [detail, initialPage, pageCount]);

    useEffect(() => {
        setPageError(false);
        setPageLoading(true);
    }, [page, item.id, imageRevision, readerTab]);

    const learn = () => {
        if (
            !allowed ||
            forbidden ||
            !isLearnable(currentItem) ||
            state === 'learning'
        )
            return;
        showConfirm(
            '이 자료를 학습할까요?',
            '이 자료의 내용을 추출해 브레인이 참고할 수 있게 준비해요. 동영상 변환과 문서 분석에는 AI 사용량이 발생할 수 있어요.',
            () => {
                if (!mounted.current || submitting.current || !canWrite.current)
                    return;
                submitting.current = true;
                setBusy(true);
                void learnLibraryItem(
                    courseId,
                    currentItem.type,
                    currentItem.id,
                )
                    .then(() => {
                        if (mounted.current)
                            setRevision((previous) => previous + 1);
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
                        submitting.current = false;
                        if (mounted.current) setBusy(false);
                    });
            },
            '학습하기',
        );
    };

    const openLibrary = () =>
        navigation.navigate('CourseLibrary', { courseId, courseName: title });
    if (labsLoading || (allowed && loading))
        return <LoadingState label="자료 내용을 불러오는 중" />;
    if (!allowed || forbidden)
        return (
            <div className="web-page">
                <EmptyState
                    title="이 자료를 열 수 없어요"
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
    if (!detail)
        return (
            <div className="web-page">
                <EmptyState
                    title="자료를 불러오지 못했어요"
                    description={error}
                    action={
                        <div className="library-inline-actions">
                            <button
                                className="web-button"
                                onClick={openLibrary}
                            >
                                자료 목록
                            </button>
                            <button
                                className="web-button"
                                onClick={() =>
                                    setRevision((previous) => previous + 1)
                                }
                            >
                                다시 시도
                            </button>
                        </div>
                    }
                />
            </div>
        );

    const noContentDescription =
        state === 'learning'
            ? '내용을 준비하고 있어요. 학습이 끝나면 이 화면에 자동으로 표시돼요.'
            : state === 'failed'
              ? '내용을 준비하는 중 문제가 생겼어요. 학습을 다시 시도하거나 원본을 확인해 주세요.'
              : state === 'unavailable'
                ? '추출할 텍스트가 없거나 지원하지 않는 형식·크기일 수 있어요. 원본에서 내용을 확인해 주세요.'
                : item.type === 'board'
                  ? '동기화된 게시글이 없어요. LearnUs에서 게시판을 확인할 수 있어요.'
                  : '아직 읽을 내용이 준비되지 않았어요. 자료를 학습하거나 LearnUs에서 원본을 확인해 주세요.';
    const textStyle = {
        fontSize: 15,
        lineHeight: 28,
        color: colors.textPrimary,
    };

    return (
        <div className="web-page library-reader-page">
            <nav className="library-breadcrumb" aria-label="현재 위치">
                <button onClick={openLibrary}>{title} 자료</button>
                <span>/</span>
                <span aria-current="page">{libraryTypeLabels[item.type]}</span>
            </nav>
            <PageHeading
                title={detail.title}
                description={detail.week ? shortenWeek(detail.week) : title}
                actions={
                    <>
                        {navigation.canGoBack() && (
                            <button
                                className="web-button"
                                onClick={() => navigation.goBack()}
                            >
                                이전 화면
                            </button>
                        )}
                        {originalUrl && (
                            <a
                                className="web-button"
                                href={originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                원본 열기
                                <WebIcon name="open-outline" size={15} />
                            </a>
                        )}
                    </>
                }
            />
            {error && (
                <div className="web-error" role="alert">
                    {error}
                    <button
                        className="web-button small"
                        onClick={() => setRevision((previous) => previous + 1)}
                    >
                        다시 시도
                    </button>
                </div>
            )}
            <div className="library-reader-layout">
                <section
                    className="library-reader-main web-panel"
                    aria-label="자료 내용"
                >
                    {isPdf && (
                        <div className="library-reader-toolbar">
                            <div
                                className="library-filters"
                                role="group"
                                aria-label="자료 보기 방식"
                            >
                                <button
                                    aria-pressed={readerTab === 'pages'}
                                    className={
                                        readerTab === 'pages' ? 'is-active' : ''
                                    }
                                    onClick={() => setReaderTab('pages')}
                                >
                                    페이지
                                </button>
                                <button
                                    aria-pressed={readerTab === 'text'}
                                    className={
                                        readerTab === 'text' ? 'is-active' : ''
                                    }
                                    onClick={() => setReaderTab('text')}
                                >
                                    추출 텍스트
                                </button>
                            </div>
                            {readerTab === 'pages' && (
                                <div className="library-pager">
                                    <button
                                        className="web-icon-button"
                                        aria-label="이전 페이지"
                                        disabled={page <= 1}
                                        onClick={() =>
                                            setPage((previous) => previous - 1)
                                        }
                                    >
                                        <WebIcon
                                            name="chevron-back"
                                            size={18}
                                        />
                                    </button>
                                    <label>
                                        <input
                                            key={`${item.id}-${page}`}
                                            type="number"
                                            min="1"
                                            max={pageCount}
                                            defaultValue={page}
                                            aria-label="PDF 페이지"
                                            onBlur={(event) => {
                                                const requested = Number(
                                                    event.target.value,
                                                );
                                                const next = Number.isFinite(
                                                    requested,
                                                )
                                                    ? Math.max(
                                                          1,
                                                          Math.min(
                                                              pageCount,
                                                              Math.floor(
                                                                  requested,
                                                              ),
                                                          ),
                                                      )
                                                    : page;
                                                setPage(next);
                                                event.target.value =
                                                    String(next);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter')
                                                    event.currentTarget.blur();
                                            }}
                                        />
                                        <span>/ {pageCount}</span>
                                    </label>
                                    <button
                                        className="web-icon-button"
                                        aria-label="다음 페이지"
                                        disabled={page >= pageCount}
                                        onClick={() =>
                                            setPage((previous) => previous + 1)
                                        }
                                    >
                                        <WebIcon
                                            name="chevron-forward"
                                            size={18}
                                        />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {isPdf && readerTab === 'pages' ? (
                        <div
                            className="library-pdf-frame"
                            aria-busy={pageLoading}
                        >
                            {pageLoading && !pageError && (
                                <div className="library-pdf-loading">
                                    <LoadingState
                                        label={`${page}쪽을 불러오는 중`}
                                    />
                                </div>
                            )}
                            {pageError ? (
                                <EmptyState
                                    title="페이지를 표시하지 못했어요"
                                    description="저장된 원본이 없거나 연결이 끊겼을 수 있어요. 다시 시도하거나 원본을 열어 주세요."
                                    action={
                                        <button
                                            className="web-button"
                                            onClick={() =>
                                                setImageRevision(
                                                    (previous) => previous + 1,
                                                )
                                            }
                                        >
                                            페이지 다시 불러오기
                                        </button>
                                    }
                                />
                            ) : (
                                <img
                                    key={`${item.id}-${page}-${imageRevision}`}
                                    src={filePageSource(item.id, page).uri}
                                    alt={`${detail.title}, ${page}쪽`}
                                    onLoad={() => setPageLoading(false)}
                                    onError={() => {
                                        setPageError(true);
                                        setPageLoading(false);
                                    }}
                                />
                            )}
                        </div>
                    ) : item.type === 'board' ? (
                        <div className="library-posts">
                            {detail.posts?.length ? (
                                detail.posts.map((post) => (
                                    <article
                                        key={post.id}
                                        className="library-post"
                                    >
                                        <h2>{post.title}</h2>
                                        <p className="library-note">
                                            {[post.writer, post.date]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                        {post.content ? (
                                            <div className="library-prose">
                                                <LinkedText
                                                    style={textStyle}
                                                    selectable
                                                >
                                                    {post.content}
                                                </LinkedText>
                                            </div>
                                        ) : (
                                            <p className="library-note">
                                                게시글 본문이 아직 저장되지
                                                않았어요.
                                            </p>
                                        )}
                                        {sourceUrl(post.url) && (
                                            <a
                                                className="library-source-link"
                                                href={sourceUrl(post.url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                게시글 원본
                                                <WebIcon
                                                    name="open-outline"
                                                    size={14}
                                                />
                                            </a>
                                        )}
                                    </article>
                                ))
                            ) : (
                                <EmptyState
                                    title="게시글이 없어요"
                                    description={noContentDescription}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="library-document">
                            {detail.summary && (
                                <section className="library-summary">
                                    <h2>강의 요약</h2>
                                    <LinkedText style={textStyle} selectable>
                                        {detail.summary}
                                    </LinkedText>
                                </section>
                            )}
                            {detail.content ? (
                                <section>
                                    <h2>
                                        {item.type === 'vod'
                                            ? '강의 전문'
                                            : item.type === 'assignment'
                                              ? '과제 안내'
                                              : '추출된 내용'}
                                    </h2>
                                    <div className="library-prose">
                                        <LinkedText
                                            style={textStyle}
                                            selectable
                                        >
                                            {detail.content}
                                        </LinkedText>
                                    </div>
                                </section>
                            ) : (
                                <EmptyState
                                    title={
                                        state === 'learning'
                                            ? '자료를 학습하고 있어요'
                                            : '읽을 내용이 없어요'
                                    }
                                    description={noContentDescription}
                                />
                            )}
                        </div>
                    )}
                </section>
                <aside className="library-reader-aside">
                    <section className="web-panel library-detail-card">
                        <h2>자료 정보</h2>
                        <dl>
                            <div>
                                <dt>유형</dt>
                                <dd>
                                    {libraryTypeLabels[item.type]}
                                    {detail.kind && item.type === 'file'
                                        ? ` · ${detail.kind.toUpperCase()}`
                                        : ''}
                                </dd>
                            </div>
                            {pageCount > 0 && (
                                <div>
                                    <dt>분량</dt>
                                    <dd>{pageCount}쪽</dd>
                                </div>
                            )}
                            {!!detail.duration && (
                                <div>
                                    <dt>재생 시간</dt>
                                    <dd>
                                        {Math.round(detail.duration / 60)}분
                                    </dd>
                                </div>
                            )}
                            {detail.due_date && (
                                <div>
                                    <dt>과제 마감</dt>
                                    <dd>{detail.due_date.slice(0, 16)}</dd>
                                </div>
                            )}
                            {typeof detail.completed === 'boolean' && (
                                <div>
                                    <dt>
                                        {item.type === 'vod' ? '시청' : '과제'}
                                    </dt>
                                    <dd>
                                        {detail.completed
                                            ? '완료 표시됨'
                                            : '미완료'}
                                    </dd>
                                </div>
                            )}
                            <div>
                                <dt>학습 상태</dt>
                                <dd className={`library-status is-${state}`}>
                                    {busy
                                        ? '요청 중'
                                        : libraryStateLabels[state]}
                                </dd>
                            </div>
                            {detail.chars > 0 && (
                                <div>
                                    <dt>학습 텍스트</dt>
                                    <dd>{detail.chars.toLocaleString()}자</dd>
                                </div>
                            )}
                        </dl>
                        {!!detail.captioned_pages && (
                            <p className="library-note">
                                {detail.captioned_pages}쪽의 도표·이미지 설명이
                                학습 내용에 포함돼요.
                            </p>
                        )}
                        {!currentItem.in_corpus && (
                            <p className="library-note">
                                {state === 'learning'
                                    ? '학습이 끝나면 브레인이 이 내용을 참고할 수 있어요.'
                                    : '이 자료는 아직 브레인의 답변에 포함되지 않아요.'}
                            </p>
                        )}
                        {!currentItem.in_corpus && isLearnable(currentItem) && (
                            <button
                                className="web-button"
                                disabled={busy || state === 'learning'}
                                aria-busy={busy}
                                onClick={learn}
                            >
                                {busy
                                    ? '요청 중'
                                    : state === 'learning'
                                      ? '학습 진행 중'
                                      : state === 'failed'
                                        ? '학습 다시 시도'
                                        : '이 자료 학습하기'}
                            </button>
                        )}
                    </section>
                    <section className="library-reader-navigation">
                        <button
                            className="web-button primary"
                            disabled={!canChat}
                            onClick={() =>
                                navigation.navigate('CourseBrainChat', {
                                    courseId,
                                    courseName: title,
                                })
                            }
                        >
                            브레인에 질문
                        </button>
                        {!canChat && (
                            <p className="library-note">
                                {library?.brain.enabled
                                    ? '참고할 자료가 준비되면 질문할 수 있어요.'
                                    : '강의 학습을 켜면 준비된 자료를 바탕으로 질문할 수 있어요.'}
                            </p>
                        )}
                        <button className="web-button" onClick={openLibrary}>
                            전체 자료 보기
                        </button>
                        {!library?.brain.enabled && (
                            <button
                                className="library-text-button"
                                onClick={() =>
                                    navigation.navigate('BrainSettings')
                                }
                            >
                                학습 설정
                            </button>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    );
}
