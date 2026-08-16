import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Animated,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getCourses, syncCourse } from './services/api';
import { useToast } from './context/ToastContext';
import { ScreenHeader } from './components/Header';
import Badge from './components/Badge';
import EmptyState from './components/EmptyState';
import { useTourRef } from './hooks/useTourRef';
import { useTour } from './context/TourContext';
import { TOUR_MOCK_COURSES, FORCE_MOCK_MODE } from './constants/tourMockData';
import { isDemoMode } from './services/demoMode';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Course color palette for variety
const getCourseColors = (colors: ColorScheme) => [
    colors.primary,
    colors.secondary,
    colors.tertiary,
    colors.accent,
    colors.success,
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EC4899', // Pink
];

const getCourseColor = (index: number, colors: ColorScheme) => getCourseColors(colors)[index % getCourseColors(colors).length];

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
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const color = getCourseColor(index, colors);

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
                    {/* Course info. No icon here: the glyph was identical in every
                        row, and the accent bar already carries the course colour. */}
                    <View style={styles.courseInfo}>
                        {courseCode && (
                            <Text style={[styles.courseCode, { color }]}>{courseCode}</Text>
                        )}
                        <Text style={styles.courseName} numberOfLines={2}>
                            {item.name}
                        </Text>
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
                                color={syncing ? colors.primary : colors.textTertiary}
                            />
                        </Animated.View>
                    </TouchableOpacity>

                    {/* Chevron */}
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={colors.textTertiary}
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
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const navigation = useNavigation();
    const { showSuccess, showError } = useToast();
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncingId, setSyncingId] = useState<number | null>(null);

    // Tour
    const { isActive: tourActive } = useTour();
    const tourActiveRef = useRef(false);
    const prevTourActive = useRef(false);
    const firstCardRef = useTourRef('courses-first-card');

    useEffect(() => { loadCourses(); }, []);

    useEffect(() => {
        const mockActive = tourActive || FORCE_MOCK_MODE || isDemoMode();
        tourActiveRef.current = mockActive;
        if (mockActive) {
            setCourses(TOUR_MOCK_COURSES);
            setLoading(false);
        } else if (prevTourActive.current) {
            loadCourses();
        }
        prevTourActive.current = mockActive;
    }, [tourActive]);

    const loadCourses = async () => {
        if (tourActiveRef.current) return;
        try {
            const data = await getCourses();
            if (tourActiveRef.current) return;
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
            showSuccess('동기화 완료', '강의 내용을 업데이트했어요.');
        } catch (e) {
            showError('동기화 실패', '강의 내용을 업데이트하지 못했어요.');
        } finally {
            setSyncingId(null);
        }
    };

    const activeCourses = courses.filter(c => c.is_active !== false);

    const renderCourseCard = ({ item, index }: { item: any; index: number }) => {
        const card = (
            <CourseCard
                item={item}
                index={index}
                onPress={() => (navigation as any).navigate('CourseDetail', { course: item })}
                onSync={() => handleSync(item.id)}
                syncing={syncingId === item.id}
            />
        );
        if (index === 0) {
            return <View ref={firstCardRef} collapsable={false}>{card}</View>;
        }
        return card;
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <ScreenHeader
                title="내 강의실"
                subtitle={`${activeCourses.length}개의 활성 강의`}
                rightAction={{
                    label: '편집',
                    onPress: () => (navigation as any).navigate('ManageCourses'),
                }}
                style={{ paddingHorizontal: 0 }}
            />

            {/* The "N 강의" pill used to sit here. It restated the "N개의 활성 강의"
                subtitle directly above it, and as the only pill it filtered nothing. */}
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
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
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="book-outline"
                        title="등록된 강의가 없어요"
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
const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContainer: {
        marginBottom: Spacing.m,
    },
    listContent: {
        paddingHorizontal: Spacing.l,
        paddingBottom: Spacing.xxl,
    },

    // Course Card
    courseCard: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        ...layout.shadow.default,
    },
    accentBar: {
        height: 4,
        width: '100%',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.m,
        // The 52pt icon tile used to set the row height; keep it explicit so
        // rows stay comfortable to tap now that the tile is gone.
        paddingVertical: Spacing.s + 4,
    },
    courseInfo: {
        flex: 1,
        marginRight: Spacing.s,
    },
    courseCode: {
        ...typography.overline,
        marginBottom: 2,
    },
    courseName: {
        ...typography.subtitle1,
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
        ...typography.caption,
        color: colors.textTertiary,
    },
    syncButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.xs,
    },
    syncButtonActive: {
        backgroundColor: colors.primaryLighter,
    },
    chevron: {
        marginLeft: Spacing.xs,
    },
});
