import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getCourses, syncCourse } from './services/api';

const CourseCard = ({ item, onSync, syncing }: { item: any, onSync: () => void, syncing: boolean }) => {
    const navigation = useNavigation();

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => (navigation as any).navigate('CourseDetail', { course: item })}
        >
            <View style={styles.iconContainer}>
                <Ionicons name="book-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.courseTitle} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.professor}>ID: {item.id}</Text>
            </View>
            <TouchableOpacity
                style={[styles.syncButton, syncing && styles.syncingButton]}
                onPress={onSync}
                disabled={syncing}
            >
                {syncing ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                    <Ionicons name="refresh" size={20} color={Colors.primary} />
                )}
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

export default function CoursesScreen() {
    const navigation = useNavigation();
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncingId, setSyncingId] = useState<number | null>(null);

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        try {
            const data = await getCourses();
            setCourses(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (courseId: number) => {
        setSyncingId(courseId);
        try {
            await syncCourse(courseId);
            await loadCourses();
            Alert.alert('동기화 완료', '강의 내용이 업데이트되었습니다.');
        } catch (e) {
            Alert.alert('동기화 실패', '강의 내용을 업데이트하지 못했습니다.');
        } finally {
            setSyncingId(null);
        }
    };

    const activeCourses = courses.filter(c => c.is_active !== false);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>내 강의실</Text>
                <TouchableOpacity
                    onPress={() => (navigation as any).navigate('ManageCourses')}
                    style={styles.manageButton}
                >
                    <Text style={styles.manageButtonText}>편집</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                data={activeCourses}
                renderItem={({ item }) => (
                    <CourseCard
                        item={item}
                        onSync={() => handleSync(item.id)}
                        syncing={syncingId === item.id}
                    />
                )}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={loadCourses} />
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>등록된 강의가 없습니다.</Text>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        backgroundColor: Colors.background,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.s,
    },
    headerTitle: {
        ...Typography.header1,
        fontSize: 28,
    },
    manageButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: Colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    manageButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    listContent: {
        padding: Spacing.l,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: Spacing.l,
        marginBottom: Spacing.m,
        borderRadius: Layout.borderRadius.l,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.sm,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16, // Squircle
        backgroundColor: Colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.m,
    },
    cardContent: {
        flex: 1,
        marginRight: Spacing.s,
    },
    courseTitle: {
        ...Typography.subtitle1,
        marginBottom: 4,
    },
    professor: {
        ...Typography.caption,
        color: Colors.textSecondary,
    },
    syncButton: {
        padding: 8,
        backgroundColor: Colors.secondary,
        borderRadius: 20,
    },
    syncingButton: {
        opacity: 0.7,
    },
    emptyContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        ...Typography.body2,
        color: Colors.textTertiary,
    }
});
