import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    TextInput, FlatList, KeyboardAvoidingView, Platform,
    ActivityIndicator,
} from 'react-native';
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

export default function AIChatModal({ visible, onClose, vodMoodleId, title, courseName }: AIChatModalProps) {
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [remaining, setRemaining] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);

    // Reset state when modal closes
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
            flatListRef.current?.scrollToEnd({ animated: true });
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

        // Build API messages (without IDs)
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

    const renderMessage = ({ item }: { item: DisplayMessage }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[styles.messageBubbleRow, isUser && styles.messageBubbleRowUser]}>
                {!isUser && (
                    <View style={styles.avatarWrap}>
                        <Ionicons name="sparkles" size={14} color={Colors.tertiary} />
                    </View>
                )}
                <View style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                ]}>
                    <Text style={[
                        styles.messageText,
                        isUser && styles.userMessageText,
                    ]}>{item.content}</Text>
                </View>
            </View>
        );
    };

    const renderTypingIndicator = () => {
        if (!loading) return null;
        return (
            <View style={[styles.messageBubbleRow]}>
                <View style={styles.avatarWrap}>
                    <Ionicons name="sparkles" size={14} color={Colors.tertiary} />
                </View>
                <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
                    <ActivityIndicator size="small" color={Colors.tertiary} />
                    <Text style={styles.typingText}>생각하는 중...</Text>
                </View>
            </View>
        );
    };

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
                            <Ionicons name="chatbubble-ellipses" size={18} color={Colors.tertiary} />
                        </View>
                        <View>
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

                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    style={styles.flatList}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={[
                        styles.messageList,
                        messages.length === 0 && styles.emptyList,
                    ]}
                    contentInsetAdjustmentBehavior="automatic"
                    ListEmptyComponent={
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
                    }
                    ListFooterComponent={renderTypingIndicator}
                    onContentSizeChange={scrollToBottom}
                    showsVerticalScrollIndicator={false}
                    keyboardDismissMode="interactive"
                    keyboardShouldPersistTaps="handled"
                />

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
    headerTitle: {
        ...Typography.subtitle1,
        fontSize: 16,
    },
    headerSub: {
        ...Typography.caption,
        color: Colors.textTertiary,
        maxWidth: 180,
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

    // Messages
    flatList: {
        flex: 1,
    },
    messageList: {
        padding: Spacing.l,
        gap: Spacing.m,
    },
    emptyList: {
        flexGrow: 1,
    },
    messageBubbleRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.s,
    },
    messageBubbleRowUser: {
        flexDirection: 'row-reverse',
    },
    avatarWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.tertiaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    messageBubble: {
        maxWidth: '78%',
        borderRadius: Layout.borderRadius.l,
        paddingHorizontal: Spacing.m,
        paddingVertical: 12,
    },
    userBubble: {
        backgroundColor: Colors.primary,
        borderBottomRightRadius: 6,
    },
    assistantBubble: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderBottomLeftRadius: 6,
    },
    messageText: {
        ...Typography.body2,
        color: Colors.textPrimary,
        lineHeight: 22,
    },
    userMessageText: {
        color: '#FFFFFF',
    },
    typingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
    },
    typingText: {
        ...Typography.caption,
        color: Colors.textTertiary,
    },

    // Empty state
    emptyContainer: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
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

    // Quick actions
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
