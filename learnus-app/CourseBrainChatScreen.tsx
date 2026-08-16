import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { Linking } from 'react-native';
import { BlinkingCursor, SelectableMarkdown, createMarkdownStyles } from './AIChatModal';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import {
    chatWithCourseBrain,
    filePageSource,
    getCourseLibrary,
    getLibraryItem,
} from './services/api';
import type { BrainCitation, CourseLibrary } from './services/api';

interface Turn {
    role: 'user' | 'assistant';
    text: string;
    citations?: BrainCitation[];
}

const CITE_PATTERN = /\[S\d+\]/g;

/**
 * Course-grounded chat.
 *
 * Assistant answers are plain prose on the page, not bubbles: a bubble is a messenger
 * convention built for short conversational turns, and it fights a paragraph-length
 * grounded answer with sources. The user's own message keeps a bubble — the asymmetry is
 * what distinguishes speaker without decorating the answer.
 */
export default function CourseBrainChatScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(
        () => createStyles(colors, typography, layout, isDark),
        [colors, typography, layout, isDark],
    );
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { courseId, courseName } = route.params as { courseId: number; courseName?: string };

    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [library, setLibrary] = useState<CourseLibrary | null>(null);
    const [openCite, setOpenCite] = useState<string | null>(null);
    const [citePages, setCitePages] = useState<Record<string, { fileId: number; page: number } | null>>({});

    // Same renderer as the VOD chat, so answers look identical across the app.
    const markdownStyles = useMemo(() => createMarkdownStyles(colors, isDark), [colors, isDark]);

    const scrollRef = useRef<ScrollView>(null);
    const cancelRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        navigation.setOptions({ title: courseName || '강의 브레인' });
        getCourseLibrary(courseId).then(setLibrary).catch(() => {});
        return () => cancelRef.current?.();
    }, [navigation, courseName, courseId]);

    // Suggestions come from the course's own contents, so the first interaction shows
    // what the brain actually knows instead of asking the student to guess.
    const suggestions = useMemo(() => {
        if (!library) return [];
        const out: string[] = [];
        const weeks = library.sections.filter(s => s.section && s.section > 0);
        const mid = weeks[Math.floor(weeks.length / 2)];
        if (mid) out.push(`${mid.week.split('·')[0].trim()}에는 뭘 배웠나요?`);
        const assignment = library.sections
            .flatMap(s => s.items)
            .find(i => i.type === 'assignment');
        if (assignment) out.push(`${assignment.title}는 뭘 제출해야 하나요?`);
        out.push('이 과목 평가 방식이 어떻게 되나요?');
        return out.slice(0, 3);
    }, [library]);

    const send = useCallback((text: string) => {
        const question = text.trim();
        if (!question || streaming) return;

        const history = [...turns, { role: 'user' as const, text: question }];
        setTurns([...history, { role: 'assistant', text: '' }]);
        setInput('');
        setStreaming(true);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

        cancelRef.current = chatWithCourseBrain(
            courseId,
            history.map(t => ({ role: t.role, content: t.text })),
            {
                onToken: token => {
                    setTurns(prev => {
                        const next = [...prev];
                        next[next.length - 1] = {
                            ...next[next.length - 1],
                            text: next[next.length - 1].text + token,
                        };
                        return next;
                    });
                },
                onDone: citations => {
                    setTurns(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { ...next[next.length - 1], citations };
                        return next;
                    });
                    setStreaming(false);
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
                },
                onError: message => {
                    setTurns(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { role: 'assistant', text: message };
                        return next;
                    });
                    setStreaming(false);
                },
            },
        );
    }, [courseId, streaming, turns]);

    /** Resolve a cited lecture to a page image, so evidence opens beside the answer. */
    const toggleCitation = useCallback(async (citation: BrainCitation, answer: string) => {
        const key = `${citation.type}-${citation.id}`;
        if (openCite === key) { setOpenCite(null); return; }
        setOpenCite(key);

        if (citePages[key] !== undefined) return;
        if (citation.type !== 'file') { setCitePages(p => ({ ...p, [key]: null })); return; }

        try {
            const detail = await getLibraryItem(courseId, citation.type, citation.id);
            if (detail.kind !== 'pdf') { setCitePages(p => ({ ...p, [key]: null })); return; }
            // Prefer a page the answer actually pointed at.
            const near = answer.match(new RegExp(`\\[${citation.ref}\\]\\s*\\[p\\.(\\d+)\\]`))
                || answer.match(/\[p\.(\d+)\]/);
            const page = near ? Math.min(parseInt(near[1], 10), detail.pages || 1) : 1;
            setCitePages(p => ({ ...p, [key]: { fileId: citation.id, page } }));
        } catch {
            setCitePages(p => ({ ...p, [key]: null }));
        }
    }, [courseId, openCite, citePages]);

    const stats = library?.stats;

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            {/* Provenance: the honest framing for something that can be wrong. */}
            {stats && (
                <Text style={styles.provenance}>
                    자료 {stats.files} · 강의 {stats.vods} · 과제 {stats.assignments} 기준으로 답해요
                </Text>
            )}

            <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {turns.length === 0 && (
                    <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>무엇이든 물어보세요</Text>
                        <Text style={styles.emptyHint}>이 강의의 자료·공지·과제를 바탕으로 답해요.</Text>
                        {suggestions.map(s => (
                            <TouchableOpacity
                                key={s}
                                style={styles.suggestion}
                                onPress={() => send(s)}
                                activeOpacity={0.6}
                            >
                                <Text style={styles.suggestionText}>{s}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {turns.map((turn, index) =>
                    turn.role === 'user' ? (
                        <View key={index} style={styles.userRow}>
                            <View style={styles.userBubble}>
                                <Text style={styles.userText}>{turn.text}</Text>
                            </View>
                        </View>
                    ) : (
                        <View key={index} style={styles.assistantBlock}>
                            {/* The markers are provenance for the chips below; leaving them
                                inline shreds Korean prose mid-sentence. */}
                            {/* Markdown, because the model emits bold and lists and they
                                render as literal asterisks otherwise. Citation markers are
                                stripped — they are provenance for the chips below, and
                                inline they shred Korean prose mid-sentence. */}
                            {/* Mirrors the VOD chat: live Markdown plus a cursor while
                                streaming, then the selectable WebView renderer once the
                                answer is complete. Citation markers are stripped — they are
                                provenance for the chips below, and inline they shred
                                Korean prose mid-sentence. */}
                            {(() => {
                                const body = turn.text.replace(CITE_PATTERN, '').replace(/ +([.,])/g, '$1');
                                const isLive = streaming && index === turns.length - 1;
                                return isLive ? (
                                    <View>
                                        <Markdown
                                            style={markdownStyles}
                                            onLinkPress={(url: string) => { Linking.openURL(url).catch(() => {}); return false; }}
                                        >
                                            {body || ' '}
                                        </Markdown>
                                        <BlinkingCursor colors={colors} />
                                    </View>
                                ) : (
                                    <SelectableMarkdown content={body} isDark={isDark} />
                                );
                            })()}

                            {!!turn.citations?.length && (
                                <View style={styles.chips}>
                                    {turn.citations.map(c => {
                                        const key = `${c.type}-${c.id}`;
                                        const open = openCite === key;
                                        return (
                                            <TouchableOpacity
                                                key={c.ref}
                                                style={[styles.chip, open && styles.chipOpen]}
                                                onPress={() => toggleCitation(c, turn.text)}
                                                activeOpacity={0.6}
                                            >
                                                <Text style={[styles.chipText, open && styles.chipTextOpen]} numberOfLines={1}>
                                                    {c.title}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Evidence expands in place — the answer stays on screen next
                                to the slide it came from, which is the point of citing. */}
                            {!!turn.citations?.length && openCite && citePages[openCite] && (
                                <TouchableOpacity
                                    style={styles.citePage}
                                    activeOpacity={0.9}
                                    onPress={() => {
                                        const c = turn.citations!.find(x => `${x.type}-${x.id}` === openCite);
                                        const item = library?.sections.flatMap(s => s.items)
                                            .find(i => i.type === c?.type && i.id === c?.id);
                                        if (item) navigation.navigate('LibraryItem', { item, courseId, courseName });
                                    }}
                                >
                                    <Image
                                        source={filePageSource(citePages[openCite]!.fileId, citePages[openCite]!.page)}
                                        style={styles.citeImage}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.citeCaption}>
                                        {citePages[openCite]!.page}쪽 · 눌러서 전체 보기
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ),
                )}
            </ScrollView>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.inputBar}>
                    <TextInput
                        style={styles.input}
                        value={input}
                        onChangeText={setInput}
                        placeholder="강의에 대해 질문하기"
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        editable={!streaming}
                        onSubmitEditing={() => send(input)}
                    />
                    <TouchableOpacity
                        style={[styles.send, (!input.trim() || streaming) && styles.sendDisabled]}
                        onPress={() => send(input)}
                        disabled={!input.trim() || streaming}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-up" size={20} color={colors.textInverse} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        provenance: {
            ...typography.caption,
            paddingHorizontal: Spacing.l,
            paddingVertical: Spacing.s,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
        },
        scroll: { flex: 1 },
        scrollContent: { padding: Spacing.l, paddingBottom: Spacing.xl, gap: Spacing.l },

        empty: { paddingTop: Spacing.xl, gap: Spacing.s },
        emptyTitle: { ...typography.header3 },
        emptyHint: { ...typography.body2, marginBottom: Spacing.m },
        suggestion: {
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.l,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: Spacing.m,
            paddingVertical: 14,
        },
        suggestionText: { ...typography.body2, color: colors.textPrimary },

        userRow: { alignItems: 'flex-end' },
        userBubble: {
            maxWidth: '82%',
            backgroundColor: colors.surfaceMuted,
            borderRadius: layout.borderRadius.l,
            paddingHorizontal: Spacing.m,
            paddingVertical: 10,
        },
        userText: { ...typography.body1, fontSize: 16 },

        assistantBlock: { gap: Spacing.m },
        assistantText: { ...typography.body1, fontSize: 16, lineHeight: 25 },
        thinking: { alignSelf: 'flex-start' },

        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s },
        chip: {
            maxWidth: '100%',
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.full,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            paddingVertical: 6,
        },
        chipOpen: { borderColor: colors.primary, backgroundColor: colors.primaryLighter },
        chipText: { ...typography.caption, color: colors.textSecondary },
        chipTextOpen: { color: colors.primary },

        citePage: {
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.m,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        citeImage: { width: '100%', height: 200 },
        citeCaption: {
            ...typography.caption,
            paddingHorizontal: Spacing.m,
            paddingVertical: Spacing.s,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
        },

        inputBar: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: Spacing.s,
            paddingHorizontal: Spacing.l,
            paddingVertical: Spacing.s,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            backgroundColor: colors.background,
        },
        input: {
            flex: 1,
            ...typography.body1,
            fontSize: 16,
            maxHeight: 120,
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.l,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: Spacing.m,
            paddingVertical: 10,
        },
        send: {
            width: 40, height: 40, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primary,
        },
        sendDisabled: { opacity: 0.35 },
    });
