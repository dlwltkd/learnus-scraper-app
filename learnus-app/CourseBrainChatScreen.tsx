import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Linking,
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
import { useNavigation, useRoute } from '@react-navigation/native';

import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { BlinkingCursor, SelectableMarkdown, createMarkdownStyles } from './AIChatModal';
import {
    chatWithCourseBrain,
    filePageSource,
    getCourseLibrary,
    getLibraryItem,
} from './services/api';
import type { BrainCitation, CourseLibrary, LibraryItem, LibraryItemType } from './services/api';

interface Turn {
    role: 'user' | 'assistant';
    text: string;
    citations?: BrainCitation[];
}

/** Provenance markers. Stripped from prose — they belong on the chips, not mid-sentence. */
const CITE_PATTERN = /\[S\d+\]/g;

/** The model's request to show a slide at this point: [[slide:S14:12]] */
const SLIDE_PATTERN = /\[\[slide:(S\d+):(\d+)\]\]/g;

const CHIP_ICON: Record<LibraryItemType, keyof typeof Ionicons.glyphMap> = {
    file: 'document-text-outline',
    label: 'information-circle-outline',
    vod: 'play-circle-outline',
    assignment: 'create-outline',
    board: 'chatbubbles-outline',
};

type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'slide'; ref: string; page: number };

/** Split an answer into prose and the slides the model asked to show inside it. */
function splitAnswer(body: string): Segment[] {
    const segments: Segment[] = [];
    let last = 0;
    SLIDE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SLIDE_PATTERN.exec(body)) !== null) {
        if (match.index > last) segments.push({ kind: 'text', text: body.slice(last, match.index) });
        segments.push({ kind: 'slide', ref: match[1], page: parseInt(match[2], 10) });
        last = match.index + match[0].length;
    }
    if (last < body.length) segments.push({ kind: 'text', text: body.slice(last) });
    return segments;
}

/**
 * Course-grounded chat.
 *
 * Answers are prose on the page rather than bubbles — a bubble is a messenger convention
 * for short turns, and it fights a paragraph-length grounded answer. The user's message
 * keeps its bubble; the asymmetry marks the speaker without decorating the answer.
 *
 * The model can place a rendered slide mid-answer where a figure explains better than a
 * sentence would. Those become tappable artifacts, so evidence sits inside the explanation
 * rather than being something you go and look up afterwards.
 */
export default function CourseBrainChatScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(
        () => createStyles(colors, typography, layout, isDark),
        [colors, typography, layout, isDark],
    );
    const markdownStyles = useMemo(() => createMarkdownStyles(colors, isDark), [colors, isDark]);

    const navigation = useNavigation<any>();
    const route = useRoute();
    const { courseId, courseName } = route.params as { courseId: number; courseName?: string };

    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [library, setLibrary] = useState<CourseLibrary | null>(null);
    const [openCite, setOpenCite] = useState<string | null>(null);
    const [citePages, setCitePages] = useState<Record<string, { fileId: number; page: number } | null>>({});

    const scrollRef = useRef<ScrollView>(null);
    const cancelRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        navigation.setOptions({ title: courseName || '강의 브레인' });
        getCourseLibrary(courseId).then(setLibrary).catch(() => {});
        return () => cancelRef.current?.();
    }, [navigation, courseName, courseId]);

    const itemFor = useCallback((type: LibraryItemType, id: number): LibraryItem | undefined =>
        library?.sections.flatMap(s => s.items).find(i => i.type === type && i.id === id),
    [library]);

    const openItem = useCallback((type: LibraryItemType, id: number) => {
        const item = itemFor(type, id);
        if (item) navigation.navigate('LibraryItem', { item, courseId, courseName });
    }, [itemFor, navigation, courseId, courseName]);

    // Suggestions drawn from the course itself, so the first interaction demonstrates what
    // the brain knows rather than asking the student to guess.
    const suggestions = useMemo(() => {
        if (!library) return [];
        const out: string[] = [];
        const weeks = library.sections.filter(s => s.section && s.section > 0);
        const mid = weeks[Math.floor(weeks.length / 2)];
        if (mid) out.push(`${mid.week.split('·')[0].trim()}에는 뭘 배웠나요?`);
        const assignment = library.sections.flatMap(s => s.items).find(i => i.type === 'assignment');
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
                onToken: token => setTurns(prev => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    next[next.length - 1] = { ...last, text: last.text + token };
                    return next;
                }),
                onDone: citations => {
                    setTurns(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { ...next[next.length - 1], citations };
                        return next;
                    });
                    setStreaming(false);
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
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

    /** Expand a cited lecture to the page it came from, beside the answer. */
    const toggleCitation = useCallback(async (citation: BrainCitation, answer: string) => {
        const key = `${citation.type}-${citation.id}`;
        if (openCite === key) { setOpenCite(null); return; }
        setOpenCite(key);
        if (citePages[key] !== undefined) return;
        if (citation.type !== 'file') { setCitePages(p => ({ ...p, [key]: null })); return; }

        try {
            const detail = await getLibraryItem(courseId, citation.type, citation.id);
            if (detail.kind !== 'pdf') { setCitePages(p => ({ ...p, [key]: null })); return; }
            const near = answer.match(new RegExp(`\\[${citation.ref}\\]\\s*\\[p\\.(\\d+)\\]`))
                || answer.match(/\[p\.(\d+)\]/);
            const page = near ? Math.min(parseInt(near[1], 10), detail.pages || 1) : 1;
            setCitePages(p => ({ ...p, [key]: { fileId: citation.id, page } }));
        } catch {
            setCitePages(p => ({ ...p, [key]: null }));
        }
    }, [courseId, openCite, citePages]);

    const renderArtifact = (
        key: string,
        fileId: number,
        page: number,
        label: string,
        onPress: () => void,
    ) => (
        <TouchableOpacity key={key} style={styles.artifact} activeOpacity={0.85} onPress={onPress}>
            <Image
                source={filePageSource(fileId, page)}
                style={styles.artifactImage}
                resizeMode="contain"
            />
            <View style={styles.artifactBar}>
                <Ionicons name="image-outline" size={13} color={colors.textTertiary} />
                <Text style={styles.artifactLabel} numberOfLines={1}>{label}</Text>
                <Ionicons name="expand-outline" size={14} color={colors.textTertiary} />
            </View>
        </TouchableOpacity>
    );

    const renderAnswer = (turn: Turn, isLive: boolean) => {
        const body = turn.text.replace(CITE_PATTERN, '').replace(/ +([.,])/g, '$1');

        // Mid-stream a marker may be half-written and citations have not arrived, so slides
        // resolve only once the answer is complete.
        if (isLive) {
            return (
                <View>
                    <Markdown
                        style={markdownStyles}
                        onLinkPress={(url: string) => { Linking.openURL(url).catch(() => {}); return false; }}
                    >
                        {body.replace(SLIDE_PATTERN, '') || ' '}
                    </Markdown>
                    <BlinkingCursor colors={colors} />
                </View>
            );
        }

        return splitAnswer(body).map((segment, i) => {
            if (segment.kind === 'text') {
                const text = segment.text.trim();
                return text ? <SelectableMarkdown key={`t${i}`} content={text} isDark={isDark} /> : null;
            }
            const citation = turn.citations?.find(c => c.ref === segment.ref);
            if (!citation || citation.type !== 'file') return null;
            return renderArtifact(
                `s${i}`,
                citation.id,
                segment.page,
                `${citation.title} · ${segment.page}쪽`,
                () => openItem(citation.type, citation.id),
            );
        });
    };

    const stats = library?.stats;

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            {stats && (
                <View style={styles.provenanceBar}>
                    <View style={styles.dot} />
                    <Text style={styles.provenance} numberOfLines={1}>
                        자료 {stats.files} · 강의 {stats.vods} · 과제 {stats.assignments} 기준으로 답해요
                    </Text>
                </View>
            )}

            <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {turns.length === 0 && (
                    <View style={styles.empty}>
                        <View style={styles.emptyMark}>
                            <Ionicons name="sparkles" size={22} color={colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>무엇이든 물어보세요</Text>
                        <Text style={styles.emptyHint}>
                            이 강의의 자료·공지·과제를 근거로 답하고, 어디서 나왔는지 알려줘요.
                        </Text>
                        <View style={styles.suggestions}>
                            {suggestions.map(s => (
                                <TouchableOpacity
                                    key={s}
                                    style={styles.suggestion}
                                    onPress={() => send(s)}
                                    activeOpacity={0.6}
                                >
                                    <Text style={styles.suggestionText}>{s}</Text>
                                    <Ionicons name="arrow-forward" size={15} color={colors.textTertiary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {turns.map((turn, index) => {
                    const isLive = streaming && index === turns.length - 1;
                    return turn.role === 'user' ? (
                        <View key={index} style={styles.userRow}>
                            <View style={styles.userBubble}>
                                <Text style={styles.userText}>{turn.text}</Text>
                            </View>
                        </View>
                    ) : (
                        <View key={index} style={styles.assistantBlock}>
                            {renderAnswer(turn, isLive)}

                            {!!turn.citations?.length && (
                                <>
                                    <Text style={styles.sourcesLabel}>출처</Text>
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
                                                    <Ionicons
                                                        name={CHIP_ICON[c.type]}
                                                        size={13}
                                                        color={open ? colors.primary : colors.textTertiary}
                                                    />
                                                    <Text
                                                        style={[styles.chipText, open && styles.chipTextOpen]}
                                                        numberOfLines={1}
                                                    >
                                                        {c.title}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </>
                            )}

                            {openCite && citePages[openCite] && renderArtifact(
                                'cite',
                                citePages[openCite]!.fileId,
                                citePages[openCite]!.page,
                                `${citePages[openCite]!.page}쪽`,
                                () => {
                                    const c = turn.citations?.find(x => `${x.type}-${x.id}` === openCite);
                                    if (c) openItem(c.type, c.id);
                                },
                            )}
                        </View>
                    );
                })}
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
                    />
                    <TouchableOpacity
                        style={[styles.send, (!input.trim() || streaming) && styles.sendDisabled]}
                        onPress={() => send(input)}
                        disabled={!input.trim() || streaming}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={streaming ? 'ellipsis-horizontal' : 'arrow-up'}
                            size={19}
                            color={colors.textInverse}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },

        provenanceBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.s,
            paddingHorizontal: Spacing.l,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
        },
        dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
        provenance: { ...typography.caption, flex: 1 },

        scroll: { flex: 1 },
        scrollContent: { padding: Spacing.l, paddingBottom: Spacing.xl, gap: Spacing.xl },

        empty: { paddingTop: Spacing.xxl, gap: Spacing.s },
        emptyMark: {
            width: 44, height: 44, borderRadius: 14,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primaryLighter,
            marginBottom: Spacing.s,
        },
        emptyTitle: { ...typography.header2, fontSize: 24 },
        emptyHint: { ...typography.body2, lineHeight: 22, marginBottom: Spacing.l },
        suggestions: { gap: Spacing.s },
        suggestion: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.m,
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.l,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: Spacing.m,
            paddingVertical: 15,
        },
        suggestionText: { ...typography.body2, color: colors.textPrimary, flex: 1, lineHeight: 21 },

        userRow: { alignItems: 'flex-end' },
        userBubble: {
            maxWidth: '84%',
            backgroundColor: colors.surfaceMuted,
            borderRadius: 20,
            borderBottomRightRadius: 6,
            paddingHorizontal: Spacing.m,
            paddingVertical: 11,
        },
        userText: { ...typography.body1, fontSize: 16, lineHeight: 23 },

        assistantBlock: { gap: Spacing.m },

        sourcesLabel: { ...typography.overline, color: colors.textTertiary, marginBottom: -4 },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s },
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            maxWidth: '100%',
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.full,
            borderWidth: 1,
            borderColor: colors.border,
            paddingLeft: 10,
            paddingRight: 12,
            paddingVertical: 7,
        },
        chipOpen: { borderColor: colors.primary, backgroundColor: colors.primaryLighter },
        chipText: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
        chipTextOpen: { color: colors.primary },

        // Inline evidence: bordered so it reads as a distinct artifact rather than an
        // illustration, with a bar naming what it is and inviting a tap.
        artifact: {
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.l,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        artifactImage: { width: '100%', height: 210, backgroundColor: colors.surfaceMuted },
        artifactBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: Spacing.m,
            paddingVertical: 9,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
        },
        artifactLabel: { ...typography.caption, flex: 1 },

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
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: Spacing.m,
            paddingTop: 11,
            paddingBottom: 11,
        },
        send: {
            width: 42, height: 42, borderRadius: 21,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primary,
        },
        sendDisabled: { backgroundColor: colors.textMuted },
    });
