import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, Switch, ActivityIndicator, StatusBar } from 'react-native';
import { getCourses, toggleCourseActive } from './services/api';
import { COLORS, FONTS, SPACING } from './constants/theme';
import Card from './components/Card';
import Icon from './components/Icon';

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
                <View style={styles.iconContainer}>
                    <Icon name="book-outline" size={24} color={item.is_active ? COLORS.primary : COLORS.textLight} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.name, !item.is_active && { color: COLORS.textLight }]}>{item.name}</Text>
                    <Text style={styles.id}>ID: {item.id}</Text>
                </View>
            </View>
            <Switch
                value={item.is_active}
                onValueChange={() => handleToggle(item.id, item.is_active)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.surface}
            />
        </Card>
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
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.md,
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: SPACING.md,
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
    name: {
        fontSize: FONTS.sizes.md,
        fontWeight: '500',
        color: COLORS.text,
        marginBottom: 4,
    },
    id: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textSecondary,
    },
});
