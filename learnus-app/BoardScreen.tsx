import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPosts } from './services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Layout } from './constants/theme';
import Card from './components/Card';

export default function BoardScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { board } = route.params as { board: any };

    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        navigation.setOptions({
            title: board.title,
            headerStyle: { backgroundColor: Colors.surface },
            headerTintColor: Colors.textPrimary,
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
                        <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                        <Text style={styles.metaText}>{item.writer}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                        <Text style={styles.metaText}>{item.date}</Text>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
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
        backgroundColor: Colors.background,
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
        ...Typography.subtitle1,
        marginBottom: Spacing.s,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: Spacing.s,
        marginTop: Spacing.xs,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        ...Typography.caption,
    },
    emptyText: {
        ...Typography.body1,
        textAlign: 'center',
        marginTop: 40,
        color: Colors.textTertiary,
    },
});
