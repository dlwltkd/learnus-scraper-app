import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { getCourses, syncCourse, syncCoursesList } from './services/api';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, FONTS, SPACING } from './constants/theme';
import Card from './components/Card';
import Button from './components/Button';
import Icon from './components/Icon';

type RootStackParamList = {
    CourseDetail: { course: any };
    ManageCourses: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CourseDetail'>;

export default function HomeScreen() {
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<number | null>(null);
    const navigation = useNavigation<HomeScreenNavigationProp>();

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
        setSyncing(courseId);
        try {
            await syncCourse(courseId);
            await loadCourses();
            alert('동기화 완료!');
        } catch (e) {
            alert('동기화 실패');
        } finally {
            setSyncing(null);
        }
    };

    const handleSyncList = async () => {
        setLoading(true);
        try {
            await syncCoursesList();
            await loadCourses();
            alert('강의 목록 동기화 완료!');
        } catch (e) {
            alert('강의 목록 동기화 실패');
        } finally {
            setLoading(false);
        }
    };

    const activeCourses = courses.filter(c => c.is_active !== false); // Default to true if undefined

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => navigation.navigate('CourseDetail', { course: item })}
            activeOpacity={0.8}
        >
            <Card style={styles.card}>
                <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                        <Icon name="book-outline" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={styles.courseName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.courseId}>ID: {item.id}</Text>
                    </View>
                </View>
                <View style={styles.actionContainer}>
                    <Button
                        title={syncing === item.id ? "" : "동기화"}
                        onPress={() => handleSync(item.id)}
                        loading={syncing === item.id}
                        variant="outline"
                        style={styles.syncButton}
                        icon={!syncing ? <Icon name="refresh" size={16} color={COLORS.primary} /> : undefined}
                    />
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
            <View style={styles.header}>
                <Button
                    title="목록 동기화"
                    onPress={handleSyncList}
                    variant="ghost"
                    icon={<Icon name="cloud-download-outline" size={20} color={COLORS.primary} />}
                />
                <Button
                    title="관리"
                    onPress={() => (navigation as any).navigate('ManageCourses')}
                    variant="ghost"
                    icon={<Icon name="settings-outline" size={20} color={COLORS.textSecondary} />}
                    style={{ marginLeft: SPACING.sm }}
                />
            </View>
            <FlatList
                data={activeCourses}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={loadCourses} />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: SPACING.md,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.md,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    textContainer: {
        flex: 1,
        marginRight: SPACING.sm,
    },
    courseName: {
        fontSize: FONTS.sizes.md,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    courseId: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textSecondary,
    },
    actionContainer: {
        justifyContent: 'center',
    },
    syncButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        minWidth: 80,
    },
});
