import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

export interface NotificationSettings {
    unfinishedAssignments: string[]; // ['1h', '6h', '12h', '1d']
    finishedAssignments: string[];
    unfinishedVods: string[];
    aiSummary: boolean;
    // New Features
    newAssignment: boolean; // Server Push
    newVod: boolean;        // Server Push
    vodOpen: boolean;       // Local Reminder
}

const DEFAULT_SETTINGS: NotificationSettings = {
    unfinishedAssignments: ['1d'],
    finishedAssignments: [],
    unfinishedVods: ['1d'],
    aiSummary: true,
    newAssignment: true,
    newVod: true,
    vodOpen: true,
};

const OPTIONS = [
    { label: '1시간 전', value: '1h' },
    { label: '5시간 전', value: '5h' },
    { label: '12시간 전', value: '12h' },
    { label: '1일 전', value: '1d' },
];

export default function NotificationSettingsScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
            if (saved) {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async (newSettings: NotificationSettings) => {
        setSettings(newSettings);
        try {
            await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));

            // Sync Push Preferences to Server
            // We do this optimistically (no await blocking UI)
            const { updateNotificationPreferences } = require('./services/api');
            updateNotificationPreferences({
                new_assignment: newSettings.newAssignment,
                new_vod: newSettings.newVod,
                notice: newSettings.aiSummary // Using aiSummary toggle for general notice push for now?
                // Or AI Summary is strictly AI. Let's assume 'notice' on server is tied to AI Summary toggle
                // or we add a separate toggle. User asked for 2 things.
                // Let's assume aiSummary controls the "Notice" push aspect as traditionally it was linked.
            }).catch((err: any) => console.log("Failed to sync prefs to server", err));

        } catch (e) {
            console.error("Failed to save settings", e);
        }
    };

    const toggleOption = (key: keyof NotificationSettings, value: string) => {
        const currentValues = settings[key] as string[];
        let newValues;
        if (currentValues.includes(value)) {
            newValues = currentValues.filter(v => v !== value);
        } else {
            newValues = [...currentValues, value];
        }
        saveSettings({ ...settings, [key]: newValues });
    };

    const updateSetting = (key: keyof NotificationSettings, value: any) => {
        saveSettings({ ...settings, [key]: value });
    };

    const renderPicker = (title: string, key: keyof NotificationSettings) => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.optionsContainer}>
                {OPTIONS.map((option) => {
                    const isSelected = (settings[key] as string[]).includes(option.value);
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.optionButton,
                                isSelected && styles.optionButtonActive
                            ]}
                            onPress={() => toggleOption(key, option.value)}
                        >
                            <Text style={[
                                styles.optionText,
                                isSelected && styles.optionTextActive
                            ]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderToggle = (title: string, description: string, key: keyof NotificationSettings) => (
        <View style={styles.toggleSection}>
            <View style={{ flex: 1, marginRight: Spacing.m }}>
                <Text style={styles.toggleTitle}>{title}</Text>
                <Text style={styles.toggleDescription}>{description}</Text>
            </View>
            <Switch
                value={settings[key] as boolean}
                onValueChange={(value) => updateSetting(key, value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={'#fff'}
            />
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.content}>

                <Text style={styles.groupTitle}>과제 마감 전 알림</Text>
                {renderPicker('제출 안된 과제 알림', 'unfinishedAssignments')}
                {renderPicker('제출된 과제 알림', 'finishedAssignments')}

                <View style={styles.divider} />

                <Text style={styles.groupTitle}>동영상 강의 마감 전 알림</Text>
                {renderPicker('미수강 강의 알림', 'unfinishedVods')}

                <View style={styles.divider} />

                <Text style={styles.groupTitle}>새로운 항목 알림 (Push)</Text>
                {renderToggle('새로운 과제 등록', '새 과제가 올라오면 즉시 알려줍니다.', 'newAssignment')}
                {renderToggle('새로운 강의 등록', '새 강의가 올라오면 즉시 알려줍니다.', 'newVod')}

                <View style={styles.divider} />

                <Text style={styles.groupTitle}>강의 오픈 알림</Text>
                {renderToggle('강의 오픈 알림', '강의 시청 시작 시간에 알림을 보냅니다.', 'vodOpen')}

                <View style={styles.divider} />

                <Text style={styles.groupTitle}>AI 알림</Text>
                {renderToggle('AI 공지 요약', '새로운 공지사항이 올라오면 요약해서 알려줍니다.', 'aiSummary')}


            </ScrollView>
        </SafeAreaView>
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
    content: {
        padding: Spacing.l,
        paddingBottom: Spacing.xxl,
    },
    groupTitle: {
        ...typography.header2,
        fontSize: 18,
        marginBottom: Spacing.m,
        color: colors.primary,
    },
    section: {
        marginBottom: Spacing.l,
    },
    sectionTitle: {
        ...typography.body1,
        fontWeight: '600',
        marginBottom: Spacing.s,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    optionButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    optionText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    optionTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    toggleSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.l,
        backgroundColor: colors.surface,
        padding: Spacing.m,
        borderRadius: layout.borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
    },
    toggleTitle: {
        ...typography.body1,
        fontWeight: '600',
        marginBottom: 4,
    },
    toggleDescription: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: colors.divider,
        marginVertical: Spacing.l,
    },
    testButton: {
        padding: Spacing.m,
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.m,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: 'center',
    },
    testButtonText: {
        color: colors.primary,
        fontWeight: '600',
    },
});
