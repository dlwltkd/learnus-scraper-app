import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    TextInput, ScrollView, KeyboardAvoidingView, Platform,
    Animated, Clipboard, Keyboard,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { marked } from 'marked';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { chatWithVodStream, ChatMessage } from './services/api';

interface AIChatModalProps {
    visible: boolean;
    onClose: () => void;
    vodMoodleId: number;
    title: string;
    courseName: string;
}

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

const QUICK_ACTIONS = [
    { icon: 'list-outline' as const, label: '핵심 용어 정리', prompt: '이 강의의 핵심 용어와 개념을 정리해줘.' },
    { icon: 'document-text-outline' as const, label: '시험 대비 요약', prompt: '이 강의 내용을 시험 대비용으로 요약해줘.' },
];


function BlinkingCursor({ colors }: { colors: ColorScheme }) {
    const opacity = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, []);
    return <Animated.View style={[{ width: 2, height: 16, backgroundColor: colors.primary, borderRadius: 1, marginLeft: 1, marginBottom: 3 }, { opacity }]} />;
}

function buildHtml(content: string, isDark: boolean): string {
    const body = marked.parse(content) as string;
    const textColor = isDark ? '#E8ECF2' : '#1A1D26';
    const textSecondary = isDark ? '#9CA3B4' : '#5C6679';
    const codeBg = isDark ? '#22252E' : '#F2F5F9';
    const codeColor = isDark ? '#6BABF9' : '#3182F6';
    const borderColor = isDark ? '#2A2D38' : '#E8ECF2';
    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body {
    margin: 0; padding: 0;
    font-family: -apple-system, 'Helvetica Neue', sans-serif;
    font-size: 14px;
    line-height: 1.65;
    color: ${textColor};
    background: transparent !important;
    word-break: break-word;
  }
  h1 { font-size: 20px; font-weight: 700; margin: 16px 0 6px; }
  h2 { font-size: 17px; font-weight: 700; margin: 14px 0 5px; }
  h3 { font-size: 15px; font-weight: 600; margin: 12px 0 4px; }
  p  { margin: 0 0 10px; }
  ul, ol { margin: 0 0 10px; padding-left: 22px; }
  li { margin-bottom: 4px; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  code {
    font-family: Menlo, 'Courier New', monospace;
    font-size: 12.5px;
    color: ${codeColor};
    background: ${codeBg};
    padding: 1px 5px;
    border-radius: 4px;
  }
  pre {
    background: ${codeBg};
    border-radius: 8px;
    padding: 12px;
    overflow-x: auto;
    margin: 8px 0;
  }
  pre code { background: none; padding: 0; color: ${textColor}; }
  blockquote {
    border-left: 3px solid ${codeColor};
    margin: 8px 0;
    padding-left: 12px;
    color: ${textSecondary};
  }
  hr { border: none; border-top: 1px solid ${borderColor}; margin: 12px 0; }
  a  { color: ${codeColor}; text-decoration: none; }
  :first-child { margin-top: 0; }
  :last-child  { margin-bottom: 0; }
</style>
</head>
<body>${body}</body>
<script>
  // Report rendered height so RN can size the WebView correctly
  function postHeight() {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'height', value: document.body.scrollHeight })
    );
  }
  window.addEventListener('load', postHeight);
  // Re-report after images / fonts settle
  setTimeout(postHeight, 300);
</script>
</html>`;
}

function SelectableMarkdown({ content, isDark }: { content: string; isDark: boolean }) {
    const [height, setHeight] = useState(40);

    const onMessage = (e: any) => {
        try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === 'height' && msg.value > 0) {
                setHeight(msg.value);
            }
        } catch {}
    };

    return (
        <WebView
            source={{ html: buildHtml(content, isDark) }}
            style={{ width: '100%', height, backgroundColor: 'transparent' }}
            scrollEnabled={false}
            onMessage={onMessage}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            originWhitelist={['*']}
            backgroundColor="transparent"
        />
    );
}


function CopyButton({ text, styles, colors }: { text: string; styles: ReturnType<typeof createStyles>; colors: ColorScheme }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        Clipboard.setString(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
            <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={14}
                color={copied ? colors.success : colors.textTertiary}
            />
            <Text style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}>
                {copied ? '복사됨' : '복사'}
            </Text>
        </TouchableOpacity>
    );
}

export default function AIChatModal({ visible, onClose, vodMoodleId, title, courseName }: AIChatModalProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const markdownStyles = useMemo(() => createMarkdownStyles(colors, isDark), [colors, isDark]);

    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [remaining, setRemaining] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    const cleanupRef = useRef<(() => void) | null>(null);
    const pendingTokensRef = useRef('');
    const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopStreaming = () => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        if (flushIntervalRef.current) {
            clearInterval(flushIntervalRef.current);
            flushIntervalRef.current = null;
        }
        pendingTokensRef.current = '';
    };

    useEffect(() => {
        if (!visible) {
            stopStreaming();
            setMessages([]);
            setInput('');
            setLoading(false);
            setRemaining(null);
            setError(null);
        }
    }, [visible]);

    useEffect(() => {
        return () => stopStreaming();
    }, []);

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const flushTokens = () => {
        if (!pendingTokensRef.current) return;
        const tokens = pendingTokensRef.current;
        pendingTokensRef.current = '';
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
                return [...prev.slice(0, -1), { ...last, content: last.content + tokens }];
            }
            return prev;
        });
        scrollToBottom();
    };

    const sendMessage = (content: string) => {
        if (!content.trim() || loading) return;

        const userMsg: DisplayMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: content.trim(),
        };
        const assistantMsg: DisplayMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            isStreaming: true,
        };

        const newMessages = [...messages, userMsg];
        setMessages([...newMessages, assistantMsg]);
        setInput('');
        setError(null);
        setLoading(true);
        scrollToBottom();

        const apiMessages: ChatMessage[] = newMessages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        pendingTokensRef.current = '';
        flushIntervalRef.current = setInterval(flushTokens, 50);

        cleanupRef.current = chatWithVodStream(vodMoodleId, apiMessages, {
            onToken: (token) => {
                pendingTokensRef.current += token;
            },
            onDone: (remaining) => {
                if (flushIntervalRef.current) {
                    clearInterval(flushIntervalRef.current);
                    flushIntervalRef.current = null;
                }
                // Final flush
                const finalTokens = pendingTokensRef.current;
                pendingTokensRef.current = '';
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.isStreaming) {
                        return [...prev.slice(0, -1), { ...last, content: last.content + finalTokens, isStreaming: false }];
                    }
                    return prev;
                });
                setRemaining(remaining);
                setLoading(false);
                scrollToBottom();
            },
            onError: (errorMsg) => {
                stopStreaming();
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.isStreaming && !last.content) {
                        return prev.slice(0, -1);
                    }
                    if (last?.isStreaming) {
                        return [...prev.slice(0, -1), { ...last, isStreaming: false }];
                    }
                    return prev;
                });
                setError(errorMsg);
                setLoading(false);
            },
        });
    };

    const isEmpty = messages.length === 0;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={[styles.container, { paddingTop: insets.top }]}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerIconWrap}>
                            <Ionicons name="sparkles" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.headerTitle}>AI 질문</Text>
                            <Text style={styles.headerSub} numberOfLines={1}>{title}</Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        {remaining !== null && (
                            <View style={styles.remainingBadge}>
                                <Text style={styles.remainingText}>{remaining}회 남음</Text>
                            </View>
                        )}
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                <ScrollView
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={[styles.scrollContent, isEmpty && styles.scrollContentEmpty]}
                    keyboardDismissMode="interactive"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {isEmpty ? (
                        /* Empty state */
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyHero}>
                                <Ionicons name="sparkles" size={28} color={colors.primary} />
                                <Text style={styles.emptyTitle}>무엇이든 물어보세요</Text>
                                <Text style={styles.emptySubtitle}>
                                    강의 내용을 바탕으로 답변해드려요
                                </Text>
                            </View>
                            <View style={styles.quickActions}>
                                {QUICK_ACTIONS.map((action, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.quickActionChip}
                                        onPress={() => sendMessage(action.prompt)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name={action.icon} size={15} color={colors.primary} />
                                        <Text style={styles.quickActionText}>{action.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        /* Conversation */
                        messages.map((item) => {
                            if (item.role === 'user') {
                                return (
                                    <View key={item.id} style={styles.userTurn}>
                                        <Text style={styles.userLabel}>질문</Text>
                                        <Text style={styles.userText} selectable>{item.content}</Text>
                                    </View>
                                );
                            }
                            return (
                                <View key={item.id} style={styles.assistantTurn}>
                                    <View style={styles.assistantHeader}>
                                        <View style={styles.assistantIconWrap}>
                                            <Ionicons name="sparkles" size={13} color={colors.primary} />
                                        </View>
                                        <Text style={styles.assistantLabel}>AI 답변</Text>
                                    </View>
                                    {item.isStreaming ? (
                                        <View>
                                            <Markdown style={markdownStyles}>
                                                {item.content || ' '}
                                            </Markdown>
                                            <BlinkingCursor colors={colors} />
                                        </View>
                                    ) : (
                                        <>
                                            <SelectableMarkdown content={item.content} isDark={isDark} />
                                            <CopyButton text={item.content} styles={styles} colors={colors} />
                                        </>
                                    )}
                                </View>
                            );
                        })
                    )}

                    {/* Spacer for scroll */}
                </ScrollView>

                {/* Error */}
                {error && (
                    <View style={styles.errorBar}>
                        <Ionicons name="alert-circle" size={16} color={colors.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Input */}
                <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? Spacing.s : (insets.bottom || Spacing.m) }]}>
                    <TextInput
                        style={styles.textInput}
                        value={input}
                        onChangeText={setInput}
                        placeholder="질문을 입력하세요..."
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        maxLength={500}
                        editable={!loading}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                        onPress={() => sendMessage(input)}
                        disabled={!input.trim() || loading}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="arrow-up"
                            size={20}
                            color={input.trim() && !loading ? '#FFF' : colors.textTertiary}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const createMarkdownStyles = (colors: ColorScheme, isDark: boolean) => StyleSheet.create({
    body: { color: colors.textPrimary, fontSize: 14, lineHeight: 23 },
    heading1: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 6 },
    heading2: { fontSize: 17, fontWeight: '700', marginTop: 14, marginBottom: 5 },
    heading3: { fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 4 },
    paragraph: { marginTop: 0, marginBottom: 10 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    code_inline: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12.5, color: colors.primary, backgroundColor: colors.surfaceMuted, paddingHorizontal: 5, borderRadius: 4 },
    fence: { backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 12, marginVertical: 8 },
    code_block: { backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 12, marginVertical: 8 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12, marginVertical: 8 },
    bullet_list: { marginBottom: 10 },
    ordered_list: { marginBottom: 10 },
    list_item: { marginBottom: 4 },
    hr: { borderColor: colors.border, marginVertical: 12 },
    link: { color: colors.primary, textDecorationLine: 'none' },
});

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
        flex: 1,
    },
    headerIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextWrap: {
        flex: 1,
    },
    headerTitle: {
        ...typography.subtitle1,
        fontSize: 16,
    },
    headerSub: {
        ...typography.caption,
        color: colors.textTertiary,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
    },
    remainingBadge: {
        backgroundColor: colors.primaryLighter,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: layout.borderRadius.full,
    },
    remainingText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
    },
    closeBtn: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 17,
        backgroundColor: colors.surfaceMuted,
    },

    // Scroll
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: Spacing.l,
        paddingBottom: Spacing.xl,
    },
    scrollContentEmpty: {
        flexGrow: 1,
    },

    // Empty state
    emptyContainer: {
        flex: 1,
        justifyContent: 'space-between',
    },
    emptyHero: {
        alignItems: 'center',
        paddingTop: 80,
        gap: 8,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        marginTop: 12,
    },
    emptySubtitle: {
        ...typography.body2,
        color: colors.textTertiary,
    },
    quickActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
        paddingBottom: Spacing.l,
    },
    quickActionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.primaryLighter,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: layout.borderRadius.full,
    },
    quickActionText: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '600',
    },

    // User turn
    userTurn: {
        marginBottom: Spacing.xl,
    },
    userLabel: {
        ...typography.caption,
        color: colors.textTertiary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: Spacing.xs,
    },
    userText: {
        ...typography.subtitle1,
        fontSize: 17,
        color: colors.textPrimary,
        lineHeight: 26,
    },

    // Assistant turn
    assistantTurn: {
        marginBottom: Spacing.xl,
        paddingBottom: Spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    assistantHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.m,
    },
    assistantIconWrap: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assistantLabel: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '700',
    },

    // Copy button
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        marginTop: Spacing.m,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: colors.surfaceMuted,
        borderRadius: layout.borderRadius.s,
    },
    copyBtnText: {
        ...typography.caption,
        color: colors.textTertiary,
        fontWeight: '600',
    },
    copyBtnTextDone: {
        color: colors.success,
    },

    // Error
    errorBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.s,
        backgroundColor: colors.errorLight,
    },
    errorText: {
        ...typography.caption,
        color: colors.error,
    },

    // Input
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.s,
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.s,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    textInput: {
        flex: 1,
        ...typography.body1,
        color: colors.textPrimary,
        backgroundColor: colors.surfaceMuted,
        borderRadius: layout.borderRadius.l,
        paddingHorizontal: Spacing.m,
        paddingTop: 12,
        paddingBottom: 12,
        maxHeight: 100,
    },
    sendBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    sendBtnDisabled: {
        backgroundColor: colors.surfaceMuted,
    },
});
