import React, { useState, useRef, useEffect } from 'react';
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
import { Colors, Spacing, Layout, Typography } from './constants/theme';
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
    { icon: 'layers-outline' as const, label: '플래시카드', prompt: '이 강의 내용으로 플래시카드(질문-답변 형식)를 만들어줘.' },
];


function BlinkingCursor() {
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
    return <Animated.View style={[styles.blinkingCursor, { opacity }]} />;
}

function buildHtml(content: string): string {
    const body = marked.parse(content) as string;
    const isDark = false; // app uses light theme
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
    color: #1A1D26;
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
    color: #3182F6;
    background: #F2F5F9;
    padding: 1px 5px;
    border-radius: 4px;
  }
  pre {
    background: #F2F5F9;
    border-radius: 8px;
    padding: 12px;
    overflow-x: auto;
    margin: 8px 0;
  }
  pre code { background: none; padding: 0; color: #1A1D26; }
  blockquote {
    border-left: 3px solid #3182F6;
    margin: 8px 0;
    padding-left: 12px;
    color: #5C6679;
  }
  hr { border: none; border-top: 1px solid #E8ECF2; margin: 12px 0; }
  a  { color: #3182F6; text-decoration: none; }
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

function SelectableMarkdown({ content }: { content: string }) {
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
            source={{ html: buildHtml(content) }}
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


function CopyButton({ text }: { text: string }) {
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
                color={copied ? Colors.success : Colors.textTertiary}
            />
            <Text style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}>
                {copied ? '복사됨' : '복사'}
            </Text>
        </TouchableOpacity>
    );
}

export default function AIChatModal({ visible, onClose, vodMoodleId, title, courseName }: AIChatModalProps) {
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
                            <Ionicons name="sparkles" size={18} color={Colors.primary} />
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
                            <Ionicons name="close" size={22} color={Colors.textSecondary} />
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
                                <Ionicons name="sparkles" size={28} color={Colors.primary} />
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
                                        <Ionicons name={action.icon} size={15} color={Colors.primary} />
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
                                            <Ionicons name="sparkles" size={13} color={Colors.primary} />
                                        </View>
                                        <Text style={styles.assistantLabel}>AI 답변</Text>
                                    </View>
                                    {item.isStreaming ? (
                                        <View>
                                            <Markdown style={markdownStyles}>
                                                {item.content || ' '}
                                            </Markdown>
                                            <BlinkingCursor />
                                        </View>
                                    ) : (
                                        <>
                                            <SelectableMarkdown content={item.content} />
                                            <CopyButton text={item.content} />
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
                        <Ionicons name="alert-circle" size={16} color={Colors.error} />
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
                        placeholderTextColor={Colors.textTertiary}
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
                            color={input.trim() && !loading ? '#FFF' : Colors.textTertiary}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const markdownStyles = StyleSheet.create({
    body: { color: '#1A1D26', fontSize: 14, lineHeight: 23 },
    heading1: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 6 },
    heading2: { fontSize: 17, fontWeight: '700', marginTop: 14, marginBottom: 5 },
    heading3: { fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 4 },
    paragraph: { marginTop: 0, marginBottom: 10 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    code_inline: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12.5, color: '#3182F6', backgroundColor: '#F2F5F9', paddingHorizontal: 5, borderRadius: 4 },
    fence: { backgroundColor: '#F2F5F9', borderRadius: 8, padding: 12, marginVertical: 8 },
    code_block: { backgroundColor: '#F2F5F9', borderRadius: 8, padding: 12, marginVertical: 8 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: '#3182F6', paddingLeft: 12, marginVertical: 8 },
    bullet_list: { marginBottom: 10 },
    ordered_list: { marginBottom: 10 },
    list_item: { marginBottom: 4 },
    hr: { borderColor: '#E8ECF2', marginVertical: 12 },
    link: { color: '#3182F6', textDecorationLine: 'none' },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.surface,
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
        backgroundColor: Colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextWrap: {
        flex: 1,
    },
    headerTitle: {
        ...Typography.subtitle1,
        fontSize: 16,
    },
    headerSub: {
        ...Typography.caption,
        color: Colors.textTertiary,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
    },
    remainingBadge: {
        backgroundColor: Colors.primaryLighter,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Layout.borderRadius.full,
    },
    remainingText: {
        ...Typography.caption,
        color: Colors.primary,
        fontWeight: '600',
    },
    closeBtn: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 17,
        backgroundColor: Colors.surfaceMuted,
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
        color: Colors.textPrimary,
        marginTop: 12,
    },
    emptySubtitle: {
        ...Typography.body2,
        color: Colors.textTertiary,
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
        backgroundColor: Colors.primaryLighter,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: Layout.borderRadius.full,
    },
    quickActionText: {
        fontSize: 13,
        color: Colors.primary,
        fontWeight: '600',
    },

    // User turn
    userTurn: {
        marginBottom: Spacing.xl,
    },
    userLabel: {
        ...Typography.caption,
        color: Colors.textTertiary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: Spacing.xs,
    },
    userText: {
        ...Typography.subtitle1,
        fontSize: 17,
        color: Colors.textPrimary,
        lineHeight: 26,
    },

    // Assistant turn
    assistantTurn: {
        marginBottom: Spacing.xl,
        paddingBottom: Spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
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
        backgroundColor: Colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assistantLabel: {
        ...Typography.caption,
        color: Colors.primary,
        fontWeight: '700',
    },

    // Streaming cursor
    blinkingCursor: {
        width: 2,
        height: 16,
        backgroundColor: Colors.primary,
        borderRadius: 1,
        marginLeft: 1,
        marginBottom: 3,
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
        backgroundColor: Colors.surfaceMuted,
        borderRadius: Layout.borderRadius.s,
    },
    copyBtnText: {
        ...Typography.caption,
        color: Colors.textTertiary,
        fontWeight: '600',
    },
    copyBtnTextDone: {
        color: Colors.success,
    },

    // Error

    errorBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.s,
        backgroundColor: Colors.errorLight,
    },
    errorText: {
        ...Typography.caption,
        color: Colors.error,
    },

    // Input
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.s,
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.s,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    textInput: {
        flex: 1,
        ...Typography.body1,
        color: Colors.textPrimary,
        backgroundColor: Colors.surfaceMuted,
        borderRadius: Layout.borderRadius.l,
        paddingHorizontal: Spacing.m,
        paddingTop: 12,
        paddingBottom: 12,
        maxHeight: 100,
    },
    sendBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    sendBtnDisabled: {
        backgroundColor: Colors.surfaceMuted,
    },
});
