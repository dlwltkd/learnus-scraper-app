import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCourses, syncCourse, syncCoursesList } from './services/api';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, Typography, Spacing, Layout } from './constants/theme';
import Card from './components/Card';
import Button from './components/Button';

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

    const activeCourses = courses.filter(c => c.is_active !== false);

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => navigation.navigate('CourseDetail', { course: item })}
            activeOpacity={0.8}
        >
            <Card style={styles.card}>
                <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="book-outline" size={24} color={Colors.primary} />
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
                        icon={!syncing ? <Ionicons name="refresh" size={16} color={Colors.primary} /> : undefined}
                    />
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
            <View style={styles.header}>
                <Button
                    title="목록 동기화"
                    onPress={handleSyncList}
                    variant="ghost"
                    icon={<Ionicons name="cloud-download-outline" size={20} color={Colors.primary} />}
                />
                <Button
                    title="관리"
                    onPress={() => (navigation as any).navigate('ManageCourses')}
                    variant="ghost"
                    icon={<Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />}
                    style={{ marginLeft: Spacing.s }}
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
        backgroundColor: Colors.background,
    },
    header: {
        padding: Spacing.s,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
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
        padding: Spacing.l,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.m,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: Layout.borderRadius.full,
        backgroundColor: Colors.primaryLighter,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.m,
    },
    textContainer: {
        flex: 1,
        marginRight: Spacing.s,
    },
    courseName: {
        ...Typography.subtitle1,
        marginBottom: 4,
    },
    courseId: {
        ...Typography.caption,
    },
    actionContainer: {
        justifyContent: 'center',
    },
    syncButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: Layout.borderRadius.s,
        minWidth: 80,
    },
});
