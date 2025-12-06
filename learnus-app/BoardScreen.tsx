import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { getPosts } from './services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING } from './constants/theme';
import Card from './components/Card';
import Icon from './components/Icon';

export default function BoardScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { board } = route.params as { board: any };

    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        navigation.setOptions({
            title: board.title,
            headerStyle: { backgroundColor: COLORS.surface },
            headerTintColor: COLORS.text,
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
                        <Icon name="person-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.metaText}>{item.writer}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Icon name="time-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.metaText}>{item.date}</Text>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: SPACING.md,
    },
    postItem: {
        marginBottom: SPACING.sm,
    },
    postTitle: {
        fontSize: FONTS.sizes.md,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.sm,
        lineHeight: 22,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: SPACING.sm,
        marginTop: SPACING.xs,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: COLORS.textLight,
        fontSize: FONTS.sizes.md,
    },
});
