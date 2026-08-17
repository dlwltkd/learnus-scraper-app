import { Ionicons } from '@expo/vector-icons';

/**
 * What a build actually covers, in the order the sweep runs it.
 *
 * Shared by the opt-in sheet and the settings screen so the promise made before the
 * spend and the reference kept afterwards cannot drift apart.
 *
 * Announcements are absent on purpose: their posts are stored by the regular sync and
 * are already in the corpus, so they are not work a build performs.
 */
export const LEARNED_CONTENT: {
    key: 'vods' | 'files' | 'assignments';
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    detail: string;
}[] = [
    {
        key: 'vods',
        icon: 'play-circle-outline',
        title: '동영상 강의',
        detail: '음성을 글로 옮겨 시간과 함께 저장해요',
    },
    {
        key: 'files',
        icon: 'document-text-outline',
        title: '강의 자료',
        detail: 'PDF·문서의 글과 슬라이드 그림까지 읽어요',
    },
    {
        key: 'assignments',
        icon: 'create-outline',
        title: '과제 안내',
        detail: '제출 방법과 조건을 함께 정리해요',
    },
];
