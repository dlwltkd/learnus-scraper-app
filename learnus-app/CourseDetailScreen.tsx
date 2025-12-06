import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
import { getAssignments, getBoards, getVods } from './services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING } from './constants/theme';
import Card from './components/Card';
import Badge from './components/Badge';
import Icon from './components/Icon';

export default function CourseDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { course } = route.params as { course: any };

    const [assignments, setAssignments] = useState<any[]>([]);
    const [boards, setBoards] = useState<any[]>([]);
    const [vods, setVods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        navigation.setOptions({
            title: course.name,
            headerStyle: { backgroundColor: COLORS.surface },
            headerTintColor: COLORS.text,
        });
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [assigns, brds, vds] = await Promise.all([
                getAssignments(course.id),
                getBoards(course.id),
                getVods(course.id)
            ]);
            setAssignments(assigns);
            setBoards(brds);
            setVods(vds);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

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
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Boards Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="chatbox-ellipses" size={20} color={COLORS.secondary} />
                        <Text style={styles.sectionTitle}>게시판</Text>
                    </View>
                    {boards.map((board) => (
                        <TouchableOpacity
                            key={board.id}
                            onPress={() => (navigation as any).navigate('Board', { board })}
                            activeOpacity={0.7}
                        >
                            <Card style={styles.boardItem}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.iconContainer}>
                                        <Icon name="chatbubble-outline" size={20} color={COLORS.primary} />
                                    </View>
                                    <Text style={styles.boardTitle}>{board.title}</Text>
                                </View>
                                <Icon name="chevron-forward" size={20} color={COLORS.textLight} />
                            </Card>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* VODs Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="play-circle" size={20} color={COLORS.primary} />
                        <Text style={styles.sectionTitle}>동영상 강의</Text>
                    </View>
                    {vods.length === 0 ? (
                        <Text style={styles.emptyText}>동영상 강의가 없습니다.</Text>
                    ) : (
                        vods.map((vod) => (
                            <Card key={vod.id} style={vod.is_completed ? { opacity: 0.7 } : {}}>
                                <View style={styles.cardHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Icon name="videocam-outline" size={18} color={COLORS.textSecondary} />
                                        <Text style={[styles.itemTitle, vod.is_completed && { color: COLORS.textLight }]} numberOfLines={1}>
                                            {vod.title}
                                        </Text>
                                    </View>
                                    {vod.is_completed && <Badge label="완료" color={COLORS.success} />}
                                </View>
                                <Text style={styles.itemDate}>
                                    {vod.start_date ? `${vod.start_date} ~ ${vod.end_date}` : '날짜 없음'}
                                </Text>
                            </Card>
                        ))
                    )}
                </View>

                {/* Assignments Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="document-text" size={20} color={COLORS.primary} />
                        <Text style={styles.sectionTitle}>과제</Text>
                    </View>
                    {assignments.length === 0 ? (
                        <Text style={styles.emptyText}>과제가 없습니다.</Text>
                    ) : (
                        assignments.map((assign) => (
                            <Card key={assign.id} style={assign.is_completed ? { opacity: 0.7 } : {}}>
                                <View style={styles.cardHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Icon name="clipboard-outline" size={18} color={COLORS.textSecondary} />
                                        <Text style={[styles.itemTitle, assign.is_completed && { color: COLORS.textLight }]} numberOfLines={1}>
                                            {assign.title}
                                        </Text>
                                    </View>
                                    {assign.is_completed && <Badge label="완료" color={COLORS.success} />}
                                </View>
                                <Text style={styles.itemDate}>마감: {assign.due_date || '날짜 없음'}</Text>
                            </Card>
                        ))
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    scrollContent: {
        padding: SPACING.md,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONTS.sizes.lg,
        fontWeight: 'bold',
        color: COLORS.text,
        marginLeft: SPACING.sm,
    },
    boardItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
        paddingVertical: SPACING.lg,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    boardTitle: {
        fontSize: FONTS.sizes.md,
        color: COLORS.text,
        fontWeight: '500',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    itemTitle: {
        fontSize: FONTS.sizes.md,
        color: COLORS.text,
        marginLeft: SPACING.sm,
        flex: 1,
    },
    itemDate: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textSecondary,
        marginLeft: 26, // Align with title text (icon width + margin)
    },
    emptyText: {
        color: COLORS.textLight,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
});
