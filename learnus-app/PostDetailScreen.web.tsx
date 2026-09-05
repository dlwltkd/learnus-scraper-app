import React, { useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { getPostDetail, type BoardPost } from './services/api';
import { isDemoMode } from './services/demoMode';
import {
    EmptyState,
    LoadingState,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import './components/web/board.css';

type PostData = Partial<BoardPost>;

function htmlToPlainText(html: string): string {
    const withBreaks = html
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n');

    if (typeof DOMParser === 'undefined') {
        return withBreaks.replace(/<[^>]*>/g, '').trim();
    }

    const parsed = new DOMParser().parseFromString(withBreaks, 'text/html');
    parsed
        .querySelectorAll('script, style, noscript')
        .forEach((node) => node.remove());
    return (parsed.body.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export default function PostDetailScreen() {
    const route = useRoute();
    const navigation = useWebNavigation();
    const {
        post: initialPost,
        postId,
        boardTitle,
        courseName,
    } = (route.params ?? {}) as {
        post?: PostData;
        postId?: number;
        boardTitle?: string;
        courseName?: string;
    };
    const [post, setPost] = useState<PostData>(initialPost || {});
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const resolvedPostId = postId ?? initialPost?.id;

    const shouldFetchPost = Boolean(
        !isDemoMode() &&
            resolvedPostId &&
            (!initialPost?.content ||
                !initialPost?.writer ||
                !initialPost?.date),
    );

    useEffect(() => {
        setPost(initialPost || {});
        setLoadError(null);
    }, [postId, initialPost?.url, initialPost?.title]);

    useEffect(() => {
        if (!shouldFetchPost || !resolvedPostId) return;

        let active = true;
        setLoading(true);
        setLoadError(null);
        getPostDetail(resolvedPostId)
            .then((fullPost: PostData) => {
                if (active) setPost((current) => ({ ...current, ...fullPost }));
            })
            .catch(() => {
                if (active) setLoadError('게시물 내용을 불러오지 못했어요.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [resolvedPostId, shouldFetchPost, revision]);

    const content = post.content
        ? htmlToPlainText(post.content)
        : '내용이 없어요.';
    let sourceUrl: string | undefined;
    try {
        const parsed = new URL(post.url || '');
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:')
            sourceUrl = parsed.href;
    } catch {
        sourceUrl = undefined;
    }

    return (
        <div className="web-page board-post-page">
            <button className="board-back" onClick={() => navigation.goBack()}>
                <WebIcon name="arrow-back-outline" size={16} />
                {boardTitle || '이전 페이지'}로 돌아가기
            </button>
            <article className="web-panel board-article">
                <header className="board-article-header">
                    {(courseName || boardTitle) && (
                        <p className="board-article-eyebrow">
                            {[courseName, boardTitle]
                                .filter(Boolean)
                                .join(' / ')}
                        </p>
                    )}
                    <h1>{post.title || '게시물'}</h1>
                    <div className="board-article-meta">
                        <span>{post.writer || '작성자 정보 없음'}</span>
                        {post.date && <span>{post.date}</span>}
                        {sourceUrl && (
                            <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                LearnUs에서 보기
                                <WebIcon name="open-outline" size={14} />
                            </a>
                        )}
                    </div>
                </header>
                {loading ? (
                    <LoadingState label="게시물 내용을 불러오는 중이에요" />
                ) : loadError ? (
                    <EmptyState
                        title="내용을 불러오지 못했어요"
                        description={loadError}
                        action={
                            <button
                                className="web-button"
                                onClick={() =>
                                    setRevision((value) => value + 1)
                                }
                            >
                                다시 시도
                            </button>
                        }
                    />
                ) : (
                    <div className="board-article-content">{content}</div>
                )}
                <footer className="board-article-footer">
                    <button
                        className="web-button"
                        onClick={() => navigation.goBack()}
                    >
                        {boardTitle ? '목록으로' : '돌아가기'}
                    </button>
                    {sourceUrl &&
                        /<(?:img|table|a)\b/i.test(post.content || '') && (
                            <p className="board-source-note">
                                첨부파일과 표는 LearnUs 원문에서 확인할 수
                                있어요.
                            </p>
                        )}
                </footer>
            </article>
        </div>
    );
}
