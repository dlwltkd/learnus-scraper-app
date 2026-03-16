import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    TextInput, ScrollView, KeyboardAvoidingView, Platform,
    ActivityIndicator, Clipboard,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SelectableText } from '@rob117/react-native-selectable-text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { chatWithVod, ChatMessage } from './services/api';

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
}

const QUICK_ACTIONS = [
    { label: '핵심 용어 정리', prompt: '이 강의의 핵심 용어와 개념을 정리해줘.' },
    { label: '시험 대비 요약', prompt: '이 강의 내용을 시험 대비용으로 요약해줘.' },
    { label: '플래시카드 만들기', prompt: '이 강의 내용으로 플래시카드(질문-답변 형식)를 만들어줘.' },
];


const markdownStyles = {
    body: { fontSize: 14, lineHeight: 22, color: Colors.textPrimary },
    heading1: { fontSize: 20, fontWeight: '700' as const, color: Colors.textPrimary, marginTop: 12, marginBottom: 4 },
    heading2: { fontSize: 17, fontWeight: '700' as const, color: Colors.textPrimary, marginTop: 10, marginBottom: 4 },
    heading3: { fontSize: 15, fontWeight: '600' as const, color: Colors.textPrimary, marginTop: 8, marginBottom: 2 },
    paragraph: { fontSize: 14, lineHeight: 22, color: Colors.textPrimary, marginBottom: 8 },
    strong: { fontWeight: '700' as const, color: Colors.textPrimary },
    em: { fontStyle: 'italic' as const },
    code_inline: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13, color: Colors.tertiary,
        backgroundColor: Colors.surfaceMuted,
    },
    fence: { backgroundColor: Colors.surfaceMuted, borderRadius: 8, padding: 12, marginVertical: 8 },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    list_item: { marginBottom: 4 },
    bullet_list_icon: { color: Colors.tertiary, marginRight: 6 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: Colors.tertiary, paddingLeft: 12, marginLeft: 0, opacity: 0.8 },
    hr: { backgroundColor: Colors.border, height: 1, marginVertical: 12 },
};

function SelectableMarkdown({ content }: { content: string }) {
    const selectableRules = {
        textgroup: (node: any, children: any) => (
            <SelectableText
                key={node.key}
                menuItems={['복사']}
                onSelection={({ eventType, content: sel }: { eventType: string; content: string }) => {
                    if (eventType === '복사') Clipboard.setString(sel);
                }}
                textComponentProps={{
                    children: (
                        <Text key={node.key} selectable style={{ fontSize: 14, lineHeight: 22, color: Colors.textPrimary }}>
                            {children}
                        </Text>
                    ),
                }}
                value=""
            />
        ),
    };

    return <Markdown style={markdownStyles} rules={selectableRules}>{content}</Markdown>;
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
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (!visible) {
            setMessages([]);
            setInput('');
            setLoading(false);
            setRemaining(null);
            setError(null);
        }
    }, [visible]);

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const sendMessage = async (content: string) => {
        if (!content.trim() || loading) return;

        const userMsg: DisplayMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: content.trim(),
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setError(null);
        setLoading(true);
        scrollToBottom();

        const apiMessages: ChatMessage[] = newMessages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        try {
            const data = await chatWithVod(vodMoodleId, apiMessages);
            const assistantMsg: DisplayMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.reply,
            };
            setMessages(prev => [...prev, assistantMsg]);
            setRemaining(data.remaining);
            scrollToBottom();
        } catch (e: any) {
            const status = e?.response?.status;
            if (status === 429) {
                setError('일일 사용 한도에 도달했어요. 내일 다시 이용해주세요.');
            } else {
                setError('응답을 받지 못했어요. 다시 시도해주세요.');
            }
        } finally {
            setLoading(false);
        }
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
                            <Ionicons name="sparkles" size={18} color={Colors.tertiary} />
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
                            <View style={styles.emptyIconWrap}>
                                <Ionicons name="chatbubble-ellipses-outline" size={36} color={Colors.tertiary} />
                            </View>
                            <Text style={styles.emptyTitle}>강의 내용에 대해 질문해보세요</Text>
                            <Text style={styles.emptySubtitle}>
                                AI가 강의 텍스트를 바탕으로 답변해드려요
                            </Text>
                            <View style={styles.quickActions}>
                                {QUICK_ACTIONS.map((action, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.quickActionChip}
                                        onPress={() => sendMessage(action.prompt)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.quickActionText}>{action.label}</Text>
                                        <Ionicons name="arrow-forward" size={14} color={Colors.tertiary} />
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
                                            <Ionicons name="sparkles" size={13} color={Colors.tertiary} />
                                        </View>
                                        <Text style={styles.assistantLabel}>AI 답변</Text>
                                    </View>
                                    <SelectableMarkdown content={item.content} />
                                    <CopyButton text={item.content} />
                                </View>
                            );
                        })
                    )}

                    {/* Typing indicator */}
                    {loading && (
                        <View style={styles.assistantTurn}>
                            <View style={styles.assistantHeader}>
                                <View style={styles.assistantIconWrap}>
                                    <Ionicons name="sparkles" size={13} color={Colors.tertiary} />
                                </View>
                                <Text style={styles.assistantLabel}>AI 답변</Text>
                            </View>
                            <View style={styles.typingRow}>
                                <ActivityIndicator size="small" color={Colors.tertiary} />
                                <Text style={styles.typingText}>생각하는 중...</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Error */}
                {error && (
                    <View style={styles.errorBar}>
                        <Ionicons name="alert-circle" size={16} color={Colors.error} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Input */}
                <View style={[styles.inputBar, { paddingBottom: insets.bottom || Spacing.m }]}>
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
        backgroundColor: Colors.tertiaryLight,
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
        backgroundColor: Colors.tertiaryLight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Layout.borderRadius.full,
    },
    remainingText: {
        ...Typography.caption,
        color: Colors.tertiary,
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
        alignItems: 'center',
        paddingTop: Spacing.xxl,
    },
    emptyIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: Colors.tertiaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.l,
    },
    emptyTitle: {
        ...Typography.subtitle1,
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    emptySubtitle: {
        ...Typography.body2,
        color: Colors.textTertiary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
    },
    quickActions: {
        width: '100%',
        gap: Spacing.s,
    },
    quickActionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Layout.borderRadius.m,
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
    },
    quickActionText: {
        ...Typography.body2,
        color: Colors.tertiary,
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
        backgroundColor: Colors.tertiaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    assistantLabel: {
        ...Typography.caption,
        color: Colors.tertiary,
        fontWeight: '700',
    },

    // Typing
    typingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
        paddingVertical: Spacing.s,
    },
    typingText: {
        ...Typography.caption,
        color: Colors.textTertiary,
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
