import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { saveFlashcardDeck, type FlashcardCard } from './services/api';
import { isDemoMode } from './services/demoMode';
import { useToast } from './context/ToastContext';
import {
    EmptyState,
    PageHeading,
    WebIcon,
    useWebNavigation,
} from './components/web/WebUI';
import './components/web/flashcards.css';

interface FlashcardStudyParams {
    cards: FlashcardCard[];
    deckName: string;
    vodMoodleId?: number;
    deckId?: number;
    isPreview?: boolean;
    courseName?: string | null;
}

export default function FlashcardStudyScreen() {
    const screenId = useId();
    const cardTextId = `${screenId}-card-text`;
    const saveTitleId = `${screenId}-save-title`;
    const saveNameId = `${screenId}-save-name`;
    const route = useRoute();
    const navigation = useWebNavigation();
    const {
        cards = [],
        deckName = '플래시카드',
        vodMoodleId,
        deckId,
        isPreview,
        courseName,
    } = (route.params || {}) as Partial<FlashcardStudyParams>;
    const { showSuccess, showInfo } = useToast();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [saveName, setSaveName] = useState(deckName);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const saveDialog = useRef<HTMLDialogElement>(null);
    const saveInput = useRef<HTMLInputElement>(null);
    const focused = useRef(false);
    const demo = isDemoMode();

    useEffect(() => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setSaveName(deckName);
        setSaveError('');
    }, [deckId, vodMoodleId, deckName, cards]);

    const moveCard = useCallback(
        (direction: -1 | 1) => {
            setCurrentIndex((index) =>
                Math.max(0, Math.min(cards.length - 1, index + direction)),
            );
            setIsFlipped(false);
        },
        [cards.length],
    );

    useFocusEffect(
        useCallback(() => {
            focused.current = true;
            const onKey = (event: KeyboardEvent) => {
                if (
                    event.defaultPrevented ||
                    event.repeat ||
                    event.altKey ||
                    event.ctrlKey ||
                    event.metaKey ||
                    !cards.length
                )
                    return;
                const target =
                    event.target instanceof HTMLElement ? event.target : null;
                if (
                    target?.isContentEditable ||
                    target?.closest(
                        'input, textarea, select, [role="textbox"], dialog, [role="dialog"]',
                    )
                )
                    return;
                if (
                    document.querySelector(
                        'dialog[open], [role="dialog"][aria-modal="true"]',
                    )
                )
                    return;
                if (
                    event.key === ' ' &&
                    !target?.closest('button, a, summary')
                ) {
                    event.preventDefault();
                    setIsFlipped((value) => !value);
                } else if (event.key === 'ArrowLeft' && currentIndex > 0) {
                    event.preventDefault();
                    moveCard(-1);
                } else if (
                    event.key === 'ArrowRight' &&
                    currentIndex < cards.length - 1
                ) {
                    event.preventDefault();
                    moveCard(1);
                } else if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    setCurrentIndex(
                        event.key === 'Home' ? 0 : cards.length - 1,
                    );
                    setIsFlipped(false);
                }
            };
            window.addEventListener('keydown', onKey);
            return () => {
                focused.current = false;
                window.removeEventListener('keydown', onKey);
            };
        }, [cards.length, currentIndex, moveCard]),
    );

    const openSave = () => {
        if (demo) {
            showInfo(
                '미리보기',
                '예시 카드는 저장되지 않아요. 로그인 후 실제 강의에서 만들어보세요.',
            );
            return;
        }
        setSaveError('');
        saveDialog.current?.showModal();
        saveInput.current?.focus();
    };

    const saveDeck = async () => {
        if (saving || !saveName.trim() || !vodMoodleId || !cards.length || demo)
            return;
        setSaving(true);
        setSaveError('');
        try {
            await saveFlashcardDeck(saveName.trim(), vodMoodleId, cards);
            if (!focused.current) return;
            saveDialog.current?.close();
            showSuccess('저장 완료', '나의 플래시카드에 덱을 저장했어요.');
            navigation.goBack();
        } catch {
            if (focused.current)
                setSaveError(
                    '덱을 저장하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.',
                );
        } finally {
            if (focused.current) setSaving(false);
        }
    };

    const card = cards[currentIndex];
    const restart = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
    };

    return (
        <div className="web-page flashcards-study-page">
            <button
                className="flashcards-back"
                onClick={() => navigation.goBack()}
            >
                <WebIcon name="arrow-back-outline" size={16} />
                돌아가기
            </button>
            <PageHeading
                title={deckName}
                description={
                    [
                        courseName,
                        demo ? '예시 카드' : isPreview ? '저장 전' : null,
                    ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                }
                actions={
                    isPreview && vodMoodleId ? (
                        <button
                            className="web-button"
                            disabled={!cards.length || saving}
                            aria-busy={saving || undefined}
                            onClick={openSave}
                        >
                            덱 저장하기
                        </button>
                    ) : undefined
                }
            />
            {!card ? (
                <EmptyState
                    title="학습할 카드가 없어요"
                    description="이전 화면에서 다른 덱을 선택해주세요."
                    action={
                        <button
                            className="web-button"
                            onClick={() => navigation.goBack()}
                        >
                            돌아가기
                        </button>
                    }
                />
            ) : (
                <section
                    className="flashcards-study"
                    aria-label="플래시카드 학습"
                >
                    <div className="flashcards-study-progress">
                        <span>
                            카드 위치{' '}
                            <strong aria-live="polite">
                                {currentIndex + 1}
                                <span> / {cards.length}</span>
                            </strong>
                        </span>
                        <button
                            className="flashcards-restart"
                            onClick={restart}
                            aria-label="첫 카드부터 다시 학습"
                            aria-keyshortcuts="Home"
                        >
                            처음부터
                        </button>
                    </div>
                    <progress
                        className="flashcards-progress-bar"
                        value={currentIndex + 1}
                        max={cards.length}
                        aria-label="현재 카드 위치"
                    />
                    <button
                        className={`flashcards-flip-card ${isFlipped ? 'is-answer' : ''}`}
                        onClick={() => setIsFlipped((value) => !value)}
                        aria-label={
                            isFlipped ? '질문으로 뒤집기' : '정답으로 뒤집기'
                        }
                        aria-describedby={cardTextId}
                        aria-pressed={isFlipped}
                        aria-keyshortcuts="Space"
                    >
                        <span className="flashcards-card-label">
                            {isFlipped ? '정답' : '질문'}
                        </span>
                        <span
                            id={cardTextId}
                            className="flashcards-card-text"
                            key={`${currentIndex}:${isFlipped}`}
                            aria-live="polite"
                        >
                            {isFlipped ? card.back : card.front}
                        </span>
                    </button>
                    <div className="flashcards-study-controls">
                        <button
                            className="web-button"
                            disabled={currentIndex === 0}
                            onClick={() => moveCard(-1)}
                            aria-keyshortcuts="ArrowLeft"
                        >
                            이전 카드
                        </button>
                        <button
                            className="web-button primary flashcards-reveal"
                            onClick={() => setIsFlipped((value) => !value)}
                            aria-controls={cardTextId}
                            aria-keyshortcuts="Space"
                        >
                            {isFlipped ? '질문 보기' : '정답 보기'}
                        </button>
                        <button
                            className="web-button"
                            disabled={currentIndex === cards.length - 1}
                            onClick={() => moveCard(1)}
                            aria-keyshortcuts="ArrowRight"
                        >
                            다음 카드
                        </button>
                    </div>
                    {currentIndex === cards.length - 1 && (
                        <p className="flashcards-end-note" role="status">
                            마지막 카드예요. 처음부터 다시 복습하거나 목록으로
                            돌아갈 수 있어요.
                        </p>
                    )}
                    <div
                        className="flashcards-keyboard-hints"
                        aria-label="키보드 단축키"
                    >
                        <span>
                            <kbd>Space</kbd>카드 뒤집기
                        </span>
                        <span>
                            <kbd>←</kbd>
                            <kbd>→</kbd>카드 이동
                        </span>
                        <span>
                            <kbd>Home</kbd>
                            <kbd>End</kbd>처음 · 마지막
                        </span>
                    </div>
                </section>
            )}

            <dialog
                className="web-dialog flashcards-save-dialog"
                ref={saveDialog}
                aria-labelledby={saveTitleId}
                onCancel={(event) => {
                    if (saving) event.preventDefault();
                }}
                onClick={(event) => {
                    if (event.target === event.currentTarget && !saving)
                        saveDialog.current?.close();
                }}
            >
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void saveDeck();
                    }}
                >
                    <div className="flashcards-save-heading">
                        <h2 id={saveTitleId}>플래시카드 저장</h2>
                    </div>
                    <p>카드 {cards.length}장</p>
                    <label
                        className="flashcards-save-label"
                        htmlFor={saveNameId}
                    >
                        덱 이름
                    </label>
                    <input
                        id={saveNameId}
                        className="web-input"
                        ref={saveInput}
                        value={saveName}
                        onChange={(event) => setSaveName(event.target.value)}
                        placeholder="덱 이름을 입력하세요"
                        required
                        disabled={saving}
                    />
                    {saveError && (
                        <p className="flashcards-save-error" role="alert">
                            {saveError}
                        </p>
                    )}
                    <div className="flashcards-save-actions">
                        <button
                            className="web-button"
                            type="button"
                            disabled={saving}
                            onClick={() => saveDialog.current?.close()}
                        >
                            취소
                        </button>
                        <button
                            className="web-button primary"
                            type="submit"
                            aria-busy={saving || undefined}
                            disabled={saving || !saveName.trim()}
                        >
                            {saving ? '저장 중…' : '덱 저장하기'}
                        </button>
                    </div>
                </form>
            </dialog>
        </div>
    );
}
