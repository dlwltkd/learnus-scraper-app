import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, Switch, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCourses, toggleCourseActive } from './services/api';
import { Colors, Typography, Spacing, Layout } from './constants/theme';
import Card from './components/Card';

export default function ManageCoursesScreen() {
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    const handleToggle = async (id: number, currentValue: boolean) => {
        // Optimistic update
        setCourses(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentValue } : c));

        try {
            await toggleCourseActive(id, !currentValue);
        } catch (e) {
            console.error("Failed to toggle course", e);
            // Revert on failure
            setCourses(prev => prev.map(c => c.id === id ? { ...c, is_active: currentValue } : c));
            alert("강의 상태 업데이트 실패");
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <Card style={styles.item}>
            <View style={styles.contentContainer}>
                <View style={[styles.iconContainer, { backgroundColor: item.is_active ? Colors.primaryLighter : Colors.surfaceMuted }]}>
                    <Ionicons name="book-outline" size={24} color={item.is_active ? Colors.primary : Colors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.name, !item.is_active && { color: Colors.textTertiary }]}>{item.name}</Text>
                    <Text style={styles.id}>ID: {item.id}</Text>
                </View>
            </View>
            <Switch
                value={item.is_active}
                onValueChange={() => handleToggle(item.id, item.is_active)}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.surface}
            />
        </Card>
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
                data={courses}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.list}
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
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.m,
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: Spacing.m,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: Layout.borderRadius.m,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.m,
    },
    name: {
        ...Typography.subtitle1,
        marginBottom: 4,
    },
    id: {
        ...Typography.caption,
    },
});
