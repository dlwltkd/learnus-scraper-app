import React, {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    deleteFlashcardDeck,
    getFlashcardDeck,
    getFlashcardDecks,
    type FlashcardCard,
    type FlashcardDeckSummary,
} from './services/api';
import { isDemoMode } from './services/demoMode';
import { useToast } from './context/ToastContext';
import {
    EmptyState,
    LoadingState,
    PageHeading,
    useWebNavigation,
} from './components/web/WebUI';
import { formatDate } from './utils/datetime';
import './components/web/flashcards.css';

const SAMPLE_CARDS: FlashcardCard[] = [
    {
        front: '그래프를 구성하는 두 가지 기본 요소는 무엇인가요?',
        back: '정점(vertex)과 간선(edge)입니다. 정점은 개체를, 간선은 개체 사이의 연결 관계를 나타냅니다.',
    },
    {
        front: '깊이 우선 탐색(DFS)은 어떤 자료구조를 사용하나요?',
        back: '스택을 사용합니다. 재귀 함수로 구현하면 호출 스택이 같은 역할을 합니다.',
    },
    {
        front: '너비 우선 탐색(BFS)은 정점을 어떤 순서로 방문하나요?',
        back: '시작 정점에서 가까운 정점부터 방문합니다. 큐를 이용해 같은 거리의 정점을 먼저 처리합니다.',
    },
    {
        front: '간선이 적은 희소 그래프에는 어떤 표현 방식이 적합한가요?',
        back: '인접 리스트가 적합합니다. 실제로 존재하는 연결만 저장하므로 O(V + E)의 공간을 사용합니다.',
    },
    {
        front: '인접 행렬에서 두 정점의 연결 여부를 확인하는 시간 복잡도는?',
        back: 'O(1)입니다. 두 정점에 해당하는 행과 열의 값을 바로 확인합니다.',
    },
    {
        front: '인접 리스트로 구현한 BFS와 DFS의 시간 복잡도는?',
        back: 'O(V + E)입니다. 각 정점과 간선을 일정한 횟수만큼 방문합니다. V는 정점 수, E는 간선 수입니다.',
    },
];

const SAMPLE_DECK: FlashcardDeckSummary = {
    id: 9301,
    name: '트리와 그래프 · 핵심 개념',
    vod_moodle_id: 8001,
    course_name: '데이터구조',
    card_count: SAMPLE_CARDS.length,
    created_at: null,
};

export default function FlashcardDeckListScreen() {
    const deleteTitleId = useId();
    const navigation = useWebNavigation();
    const { showError, showInfo, showSuccess } = useToast();
    const [decks, setDecks] = useState<FlashcardDeckSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const [query, setQuery] = useState('');
    const [revision, setRevision] = useState(0);
    const [opening, setOpening] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const focused = useRef(false);
    const actionVersion = useRef(0);
    const deleteDialog = useRef<HTMLDialogElement>(null);
    const [deleteTarget, setDeleteTarget] =
        useState<FlashcardDeckSummary | null>(null);
    const [deleteError, setDeleteError] = useState('');
    const demo = isDemoMode();

    useFocusEffect(
        useCallback(() => {
            let active = true;
            focused.current = true;
            setOpening(null);
            setDeleting(null);
            setRefreshing(true);
            async function load() {
                try {
                    const data = demo
                        ? { decks: [SAMPLE_DECK] }
                        : await getFlashcardDecks();
                    if (active) {
                        setDecks(data.decks);
                        setError(false);
                    }
                } catch {
                    if (active) setError(true);
                } finally {
                    if (active) {
                        setLoading(false);
                        setRefreshing(false);
                    }
                }
            }
            void load();
            return () => {
                active = false;
                focused.current = false;
                actionVersion.current += 1;
            };
        }, [demo, revision]),
    );

    const openDeck = async (deck: FlashcardDeckSummary) => {
        if (opening !== null || deleting !== null) return;
        setOpening(deck.id);
        const version = actionVersion.current;
        try {
            const data = demo
                ? { ...SAMPLE_DECK, cards: SAMPLE_CARDS }
                : await getFlashcardDeck(deck.id);
            if (!focused.current || version !== actionVersion.current) return;
            navigation.navigate('FlashcardStudy', {
                cards: data.cards,
                deckName: data.name,
                deckId: data.id,
                vodMoodleId: data.vod_moodle_id,
                courseName: data.course_name,
                isPreview: false,
            });
        } catch {
            if (focused.current && version === actionVersion.current)
                showError(
                    '덱을 열 수 없어요',
                    '연결 상태를 확인하고 다시 시도해주세요.',
                );
        } finally {
            if (focused.current && version === actionVersion.current)
                setOpening(null);
        }
    };

    const confirmDelete = (deck: FlashcardDeckSummary) => {
        if (opening !== null || deleting !== null) return;
        if (demo) {
            showInfo('예시 덱', '미리보기의 예시 카드는 삭제할 수 없어요.');
            return;
        }
        setDeleteError('');
        setDeleteTarget(deck);
    };

    useEffect(() => {
        if (!deleteTarget) return;
        const dialog = deleteDialog.current;
        dialog?.showModal();
        return () => dialog?.close();
    }, [deleteTarget]);

    const deleteDeck = async () => {
        if (!deleteTarget || deleting !== null || demo) return;
        const version = actionVersion.current;
        const deck = deleteTarget;
        setDeleting(deck.id);
        setDeleteError('');
        try {
            await deleteFlashcardDeck(deck.id);
            if (!focused.current || version !== actionVersion.current) return;
            setDecks((current) =>
                current.filter((item) => item.id !== deck.id),
            );
            setDeleteTarget(null);
            showSuccess('삭제 완료', '플래시카드 덱을 삭제했어요.');
        } catch {
            if (focused.current && version === actionVersion.current)
                setDeleteError('덱을 삭제하지 못했어요. 다시 시도해주세요.');
        } finally {
            if (focused.current && version === actionVersion.current)
                setDeleting(null);
        }
    };

    const visibleDecks = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return decks.filter((deck) =>
            `${deck.name} ${deck.course_name || ''}`
                .toLocaleLowerCase()
                .includes(search),
        );
    }, [decks, query]);
    const totalCards = decks.reduce(
        (count, deck) => count + deck.card_count,
        0,
    );

    return (
        <div className="web-page flashcards-page">
            <PageHeading
                title="플래시카드"
                description={
                    loading
                        ? undefined
                        : `덱 ${decks.length}개 · 카드 ${totalCards}장`
                }
                actions={
                    <button
                        className="web-button"
                        disabled={
                            refreshing || opening !== null || deleting !== null
                        }
                        aria-busy={refreshing || undefined}
                        onClick={() => setRevision((value) => value + 1)}
                    >
                        {refreshing ? '불러오는 중…' : '새로고침'}
                    </button>
                }
            />
            <div className="flashcards-library-toolbar">
                <h2>
                    {query ? `검색 결과 ${visibleDecks.length}개` : '저장된 덱'}
                </h2>
                <input
                    className="web-input flashcards-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="덱 이름, 수업명 검색"
                    aria-label="플래시카드 덱 검색"
                />
            </div>
            {error && (
                <div className="web-error" role="alert">
                    <span>
                        플래시카드를 불러오지 못했어요. 연결 상태를
                        확인해주세요.
                    </span>
                    <button
                        className="web-button"
                        disabled={refreshing}
                        onClick={() => setRevision((value) => value + 1)}
                    >
                        다시 시도
                    </button>
                </div>
            )}
            {loading ? (
                <LoadingState label="나의 플래시카드를 불러오는 중이에요" />
            ) : visibleDecks.length > 0 ? (
                <ul className="web-panel flashcards-deck-list">
                    {visibleDecks.map((deck) => (
                        <li className="flashcards-deck" key={deck.id}>
                            <div className="flashcards-deck-info">
                                <span className="flashcards-deck-course">
                                    {deck.course_name || '나의 학습'}
                                </span>
                                <h3>{deck.name}</h3>
                                <p className="flashcards-deck-meta">
                                    카드 {deck.card_count}장
                                    {demo
                                        ? ' · 예시 덱'
                                        : deck.created_at
                                          ? ` · ${formatDate(deck.created_at)} 저장`
                                          : ''}
                                </p>
                            </div>
                            <div className="flashcards-deck-actions">
                                <button
                                    className="web-button"
                                    aria-label={`${deck.name} 복습하기`}
                                    aria-busy={opening === deck.id || undefined}
                                    disabled={
                                        opening !== null || deleting !== null
                                    }
                                    onClick={() => void openDeck(deck)}
                                >
                                    {opening === deck.id
                                        ? '불러오는 중…'
                                        : '복습하기'}
                                </button>
                                {!demo && (
                                    <button
                                        className="flashcards-delete"
                                        aria-label={`${deck.name} 덱 삭제`}
                                        aria-busy={
                                            deleting === deck.id || undefined
                                        }
                                        disabled={
                                            opening !== null ||
                                            deleting !== null
                                        }
                                        onClick={() => confirmDelete(deck)}
                                    >
                                        {deleting === deck.id
                                            ? '삭제 중…'
                                            : '삭제'}
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                !error && (
                    <EmptyState
                        title={
                            query
                                ? '조건에 맞는 덱이 없어요'
                                : '아직 저장한 플래시카드가 없어요'
                        }
                        description={
                            query
                                ? '다른 덱 이름이나 수업명으로 검색해보세요.'
                                : '동영상 강의의 텍스트 화면에서 플래시카드를 만들고 저장해보세요.'
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
                )
            )}
            <dialog
                ref={deleteDialog}
                className="web-dialog flashcards-save-dialog"
                aria-labelledby={deleteTitleId}
                onCancel={(event) => {
                    event.preventDefault();
                    if (deleting === null) setDeleteTarget(null);
                }}
            >
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void deleteDeck();
                    }}
                >
                    <h2 id={deleteTitleId}>덱을 삭제할까요?</h2>
                    <p>
                        {deleteTarget?.name} · 카드 {deleteTarget?.card_count}장
                    </p>
                    <p>삭제한 덱과 카드는 복구할 수 없어요.</p>
                    {deleteError && (
                        <p className="flashcards-save-error" role="alert">
                            {deleteError}
                        </p>
                    )}
                    <div className="flashcards-save-actions">
                        <button
                            type="button"
                            className="web-button"
                            disabled={deleting !== null}
                            onClick={() => setDeleteTarget(null)}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="web-button danger"
                            disabled={deleting !== null}
                            aria-busy={deleting !== null || undefined}
                        >
                            {deleting !== null ? '삭제 중…' : '덱 삭제'}
                        </button>
                    </div>
                </form>
            </dialog>
        </div>
    );
}
