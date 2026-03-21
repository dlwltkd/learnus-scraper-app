import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, Switch, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCourses, toggleCourseActive } from './services/api';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import Card from './components/Card';

export default function ManageCoursesScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        try {
            const data = await getCourses();
            setCourses([...data].sort((a, b) => b.id - a.id));
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
                <View style={[styles.iconContainer, { backgroundColor: item.is_active ? colors.primaryLighter : colors.surfaceMuted }]}>
                    <Ionicons name="book-outline" size={24} color={item.is_active ? colors.primary : colors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.name, !item.is_active && { color: colors.textTertiary }]}>{item.name}</Text>
                    <Text style={styles.id}>ID: {item.id}</Text>
                </View>
            </View>
            <Switch
                value={item.is_active}
                onValueChange={() => handleToggle(item.id, item.is_active)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
            />
        </Card>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
            <FlatList
                data={courses}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        borderRadius: layout.borderRadius.m,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.m,
    },
    name: {
        ...typography.subtitle1,
        marginBottom: 4,
    },
    id: {
        ...typography.caption,
    },
});
