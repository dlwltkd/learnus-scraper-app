import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPosts } from './services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import Card from './components/Card';

export default function BoardScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { board } = route.params as { board: any };
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        navigation.setOptions({
            title: board.title,
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
        });
        loadPosts();
    }, []);

    const loadPosts = async () => {
        try {
            const data = await getPosts(board.id);
            setPosts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => (navigation as any).navigate('PostDetail', { post: item })}
            activeOpacity={0.8}
        >
            <Card style={styles.postItem}>
                <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.metaText}>{item.writer}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.metaText}>{item.date}</Text>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
            <FlatList
                data={posts}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.emptyText}>게시물이 없습니다.</Text>}
            />
        </View>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: Spacing.l,
    },
    postItem: {
        marginBottom: Spacing.m,
    },
    postTitle: {
        ...typography.subtitle1,
        marginBottom: Spacing.s,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: Spacing.s,
        marginTop: Spacing.xs,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        ...typography.caption,
    },
    emptyText: {
        ...typography.body1,
        textAlign: 'center',
        marginTop: 40,
        color: colors.textTertiary,
    },
});
