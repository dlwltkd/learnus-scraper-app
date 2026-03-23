import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeStyles } from './hooks/useThemeStyles';
import { useToast } from './context/ToastContext';
import { getFlashcardDecks, getFlashcardDeck, deleteFlashcardDeck } from './services/api';
import type { FlashcardDeckSummary } from './services/api';
import { Spacing } from './constants/theme';

export default function FlashcardDeckListScreen({ navigation }: any) {
    const [decks, setDecks] = useState<FlashcardDeckSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const styles = useThemeStyles(createStyles);
    const { showSuccess, showError } = useToast();

    const loadDecks = useCallback(async () => {
        try {
            const data = await getFlashcardDecks();
            setDecks(data.decks);
        } catch {
            showError('오류', '덱 목록을 불러올 수 없어요.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadDecks();
        }, [loadDecks])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadDecks();
    };

    const handleDelete = (deck: FlashcardDeckSummary) => {
        Alert.alert(
            '덱 삭제',
            `"${deck.name}" 덱을 삭제할까요?`,
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteFlashcardDeck(deck.id);
                            setDecks(prev => prev.filter(d => d.id !== deck.id));
                            showSuccess('삭제 완료', '덱이 삭제되었어요.');
                        } catch {
                            showError('삭제 실패', '다시 시도해주세요.');
                        }
                    },
                },
            ]
        );
    };

    const handleOpenDeck = async (deck: FlashcardDeckSummary) => {
        try {
            const data = await getFlashcardDeck(deck.id);
            navigation.navigate('FlashcardStudy', {
                cards: data.cards,
                deckName: data.name,
                deckId: data.id,
                courseName: data.course_name,
                isPreview: false,
            });
        } catch {
            showError('오류', '덱을 불러올 수 없어요.');
        }
    };

    const formatDate = (isoStr: string | null) => {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        } catch {
            return '';
        }
    };

    const renderDeck = ({ item }: { item: FlashcardDeckSummary }) => (
        <TouchableOpacity
            style={styles.deckCard}
            onPress={() => handleOpenDeck(item)}
            onLongPress={() => handleDelete(item)}
            activeOpacity={0.7}
        >
            <View style={styles.deckIcon}>
                <Ionicons name="albums" size={22} color={styles._colors.primary} />
            </View>
            <View style={styles.deckInfo}>
                <Text style={styles.deckName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.deckMeta} numberOfLines={1}>
                    {item.course_name ? `${item.course_name} · ` : ''}
                    {item.card_count}장
                    {item.created_at ? ` · ${formatDate(item.created_at)}` : ''}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={styles._colors.textMuted} />
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={styles._colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={decks}
                keyExtractor={item => String(item.id)}
                renderItem={renderDeck}
                contentContainerStyle={decks.length === 0 ? styles.centered : styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={styles._colors.primary} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="albums-outline" size={56} color={styles._colors.textMuted} />
                        <Text style={styles.emptyTitle}>저장된 덱이 없어요</Text>
                        <Text style={styles.emptySubtitle}>강의 텍스트에서 플래시카드를 생성해보세요</Text>
                    </View>
                }
            />
        </View>
    );
}

const createStyles = ({ colors, typography, layout, spacing }: any) => {
    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        listContent: {
            padding: spacing.screenPadding,
            gap: spacing.s,
        },
        deckCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.m,
            padding: spacing.m,
            ...layout.shadow.sm,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        deckIcon: {
            width: 44,
            height: 44,
            borderRadius: layout.borderRadius.s,
            backgroundColor: colors.primaryLighter,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.m,
        },
        deckInfo: {
            flex: 1,
        },
        deckName: {
            ...typography.subtitle2,
            color: colors.textPrimary,
        },
        deckMeta: {
            ...typography.caption,
            color: colors.textTertiary,
            marginTop: 2,
        },
        emptyState: {
            alignItems: 'center',
            gap: spacing.s,
        },
        emptyTitle: {
            ...typography.subtitle1,
            color: colors.textSecondary,
            marginTop: spacing.m,
        },
        emptySubtitle: {
            ...typography.body2,
            color: colors.textTertiary,
        },
    });
    return { ...styles, _colors: colors };
};
