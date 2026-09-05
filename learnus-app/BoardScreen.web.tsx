import React, { useEffect, useMemo, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { getPosts, type BoardPost, type CourseBoard } from './services/api';
import { isDemoMode } from './services/demoMode';
import {
    EmptyState,
    LoadingState,
    PageHeading,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import './components/web/board.css';

const PREVIEW_POSTS: BoardPost[] = [
    {
        id: 9201,
        title: '이번 주 수업 및 과제 안내',
        writer: '담당 교수',
        date: '2026-09-04',
        url: '',
        content:
            '<p>이번 주에는 강의의 핵심 개념을 정리하고 예제를 함께 살펴봅니다.</p><p>수업 전에 동영상 강의를 시청하고, 강의실에 올라온 과제를 확인해주세요.</p>',
    },
    {
        id: 9202,
        title: '강의 자료가 업데이트되었습니다',
        writer: '담당 교수',
        date: '2026-09-03',
        url: '',
        content:
            '<p>수업에서 사용할 강의 자료를 업로드했어요.</p><p>LearnUs에서 자료를 내려받아 수업에 참여해주세요.</p>',
    },
    {
        id: 9203,
        title: '수강생 여러분, 반갑습니다',
        writer: '담당 교수',
        date: '2026-09-01',
        url: '',
        content:
            '<p>새 학기 수업에 오신 여러분을 환영합니다.</p><p>강의 계획서와 학습 일정을 확인하고, 궁금한 점은 질문과 답변 게시판에 남겨주세요.</p>',
    },
];

export default function BoardScreen() {
    const { params } = useRoute();
    const { board, courseName } = params as {
        board: CourseBoard;
        courseName?: string;
    };
    const navigation = useWebNavigation();
    const [posts, setPosts] = useState<BoardPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [revision, setRevision] = useState(0);
    const demo = isDemoMode();

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        async function load() {
            try {
                const data = demo
                    ? board.title.includes('공지')
                        ? PREVIEW_POSTS
                        : []
                    : await getPosts(board.id);
                if (active) setPosts(data);
            } catch {
                if (active)
                    setError(
                        '게시물을 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.',
                    );
            } finally {
                if (active) setLoading(false);
            }
        }
        void load();
        return () => {
            active = false;
        };
    }, [board.id, board.title, demo, revision]);

    const visiblePosts = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return posts.filter((post) =>
            `${post.title} ${post.writer}`.toLocaleLowerCase().includes(search),
        );
    }, [posts, query]);

    return (
        <div className="web-page board-page">
            <button className="board-back" onClick={() => navigation.goBack()}>
                <WebIcon name="arrow-back-outline" size={16} />
                {courseName || '강의실'}로 돌아가기
            </button>
            <PageHeading
                title={board.title}
                description={courseName}
                actions={
                    <button
                        className="web-button"
                        disabled={loading}
                        aria-busy={loading || undefined}
                        onClick={() => setRevision((value) => value + 1)}
                    >
                        {loading ? '불러오는 중…' : '새로고침'}
                    </button>
                }
            />
            <section
                className="web-panel board-list-panel"
                aria-label="게시물 목록"
            >
                <header className="board-list-heading">
                    <p>
                        {query ? '검색 결과' : '전체 게시물'}{' '}
                        <strong>
                            {query ? visiblePosts.length : posts.length}
                        </strong>
                    </p>
                    <label className="board-search">
                        <input
                            type="search"
                            aria-label="게시물 검색"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="제목 또는 작성자 검색"
                        />
                    </label>
                </header>
                {loading ? (
                    <LoadingState label="게시물을 불러오는 중이에요" />
                ) : error ? (
                    <EmptyState
                        title="게시판에 연결하지 못했어요"
                        description={error}
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
                ) : visiblePosts.length === 0 ? (
                    <EmptyState
                        title={
                            query
                                ? '검색 결과가 없어요'
                                : '아직 등록된 게시물이 없어요'
                        }
                        description={
                            query
                                ? '다른 검색어로 다시 찾아보세요.'
                                : '새로운 게시물이 올라오면 여기에 표시돼요.'
                        }
                        action={
                            query ? (
                                <button
                                    className="web-button"
                                    onClick={() => setQuery('')}
                                >
                                    검색 초기화
                                </button>
                            ) : undefined
                        }
                    />
                ) : (
                    <div className="board-table-wrap">
                        <table className="board-table">
                            <thead>
                                <tr>
                                    <th scope="col">제목</th>
                                    <th scope="col">작성자</th>
                                    <th scope="col">등록일</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visiblePosts.map((post) => (
                                    <tr key={post.id}>
                                        <td className="board-post-title-cell">
                                            <button
                                                className="board-post-title"
                                                onClick={() =>
                                                    navigation.navigate(
                                                        'PostDetail',
                                                        {
                                                            post,
                                                            postId: post.id,
                                                            boardTitle:
                                                                board.title,
                                                            courseName,
                                                        },
                                                    )
                                                }
                                            >
                                                {post.title}
                                            </button>
                                        </td>
                                        <td className="board-post-writer">
                                            {post.writer || '작성자 정보 없음'}
                                        </td>
                                        <td className="board-post-date">
                                            {post.date || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!loading && !error && query && visiblePosts.length > 0 && (
                    <footer className="board-list-footer">
                        전체 {posts.length}개 중 {visiblePosts.length}개의
                        게시물 검색됨
                    </footer>
                )}
            </section>
        </div>
    );
}
