import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Animated,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getCourses, syncCourse } from './services/api';
import { ScreenHeader } from './components/Header';
import Badge from './components/Badge';
import EmptyState from './components/EmptyState';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Course color palette for variety
const COURSE_COLORS = [
    Colors.primary,
    Colors.secondary,
    Colors.tertiary,
    Colors.accent,
    Colors.success,
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EC4899', // Pink
];

const getCourseColor = (index: number) => COURSE_COLORS[index % COURSE_COLORS.length];

// ============================================
// COURSE CARD COMPONENT
// ============================================
interface CourseCardProps {
    item: any;
    index: number;
    onPress: () => void;
    onSync: () => void;
    syncing: boolean;
}

const CourseCard = ({ item, index, onPress, onSync, syncing }: CourseCardProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const color = getCourseColor(index);

    useEffect(() => {
        if (syncing) {
            Animated.loop(
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            rotateAnim.stopAnimation();
            rotateAnim.setValue(0);
        }
    }, [syncing]);

    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.98,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, []);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, []);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // Extract course code if available (e.g., "CSE101")
    const courseCode = item.name.match(/^[A-Z]{2,4}\d{3,4}/)?.[0];

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                style={styles.courseCard}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.95}
            >
                {/* Color accent bar */}
                <View style={[styles.accentBar, { backgroundColor: color }]} />

                <View style={styles.cardContent}>
                    {/* Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                        <Ionicons name="book" size={24} color={color} />
                    </View>

                    {/* Course info */}
                    <View style={styles.courseInfo}>
                        {courseCode && (
                            <Text style={[styles.courseCode, { color }]}>{courseCode}</Text>
                        )}
                        <Text style={styles.courseName} numberOfLines={2}>
                            {item.name}
                        </Text>
                        <View style={styles.courseMeta}>
                            <Ionicons name="school-outline" size={12} color={Colors.textTertiary} />
                            <Text style={styles.courseId}>ID: {item.id}</Text>
                        </View>
                    </View>

                    {/* Sync button */}
                    <TouchableOpacity
                        style={[styles.syncButton, syncing && styles.syncButtonActive]}
                        onPress={(e) => {
                            e.stopPropagation();
                            onSync();
                        }}
                        disabled={syncing}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Ionicons
                                name="refresh"
                                size={20}
                                color={syncing ? Colors.primary : Colors.textTertiary}
                            />
                        </Animated.View>
                    </TouchableOpacity>

                    {/* Chevron */}
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={Colors.textTertiary}
                        style={styles.chevron}
                    />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ============================================
// MAIN COURSES SCREEN
// ============================================
export default function CoursesScreen() {
    const navigation = useNavigation();
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadCourses();
    }, []);

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

    const renderCourseCard = ({ item, index }: { item: any; index: number }) => (
        <CourseCard
            item={item}
            index={index}
            onPress={() => (navigation as any).navigate('CourseDetail', { course: item })}
            onSync={() => handleSync(item.id)}
            syncing={syncingId === item.id}
        />
    );

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <ScreenHeader
                title="내 강의실"
                subtitle={`${activeCourses.length}개의 활성 강의`}
                rightAction={{
                    label: '편집',
                    onPress: () => (navigation as any).navigate('ManageCourses'),
                }}
            />

            {/* Quick stats */}
            <View style={styles.statsContainer}>
                <View style={styles.statPill}>
                    <Ionicons name="book" size={14} color={Colors.primary} />
                    <Text style={styles.statText}>{activeCourses.length} 강의</Text>
                </View>
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <FlatList
                data={activeCourses}
                renderItem={renderCourseCard}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={renderHeader}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="book-outline"
                        title="등록된 강의가 없습니다"
                        description="LearnUs에서 강의를 등록하면 여기에 표시됩니다."
                    />
                }
                ItemSeparatorComponent={() => <View style={{ height: Spacing.s }} />}
            />
        </SafeAreaView>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContainer: {
        marginBottom: Spacing.m,
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.l,
        marginTop: Spacing.s,
    },
    statPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primaryLighter,
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.xs,
        borderRadius: Layout.borderRadius.full,
        gap: 6,
    },
    statText: {
        ...Typography.caption,
        color: Colors.primary,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: Spacing.l,
        paddingBottom: Spacing.xxl,
    },

    // Course Card
    courseCard: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.l,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.default,
    },
    accentBar: {
        height: 4,
        width: '100%',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.m,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.m,
    },
    courseInfo: {
        flex: 1,
        marginRight: Spacing.s,
    },
    courseCode: {
        ...Typography.overline,
        marginBottom: 2,
    },
    courseName: {
        ...Typography.subtitle1,
        fontSize: 15,
        marginBottom: 4,
        lineHeight: 20,
    },
    courseMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    courseId: {
        ...Typography.caption,
        color: Colors.textTertiary,
    },
    syncButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.xs,
    },
    syncButtonActive: {
        backgroundColor: Colors.primaryLighter,
    },
    chevron: {
        marginLeft: Spacing.xs,
    },
});
