import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { Ionicons } from '@expo/vector-icons';

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

export interface NotificationSettings {
    unfinishedAssignments: string[]; // ['1h', '6h', '12h', '1d']
    finishedAssignments: string[];
    unfinishedVods: string[];
    aiSummary: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
    unfinishedAssignments: ['1d'],
    finishedAssignments: [],
    unfinishedVods: ['1d'],
    aiSummary: true,
};

const OPTIONS = [
    { label: '1시간 전', value: '1h' },
    { label: '5시간 전', value: '5h' },
    { label: '12시간 전', value: '12h' },
    { label: '1일 전', value: '1d' },
];

export default function NotificationSettingsScreen() {
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
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={'#fff'}
            />
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
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

                <Text style={styles.groupTitle}>AI 알림</Text>
                {renderToggle('AI 공지 요약', '새로운 공지사항이 올라오면 요약해서 알려줍니다.', 'aiSummary')}

            </ScrollView>
        </SafeAreaView>
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
    content: {
        padding: Spacing.l,
        paddingBottom: Spacing.xxl,
    },
    groupTitle: {
        ...Typography.header2,
        fontSize: 18,
        marginBottom: Spacing.m,
        color: Colors.primary,
    },
    section: {
        marginBottom: Spacing.l,
    },
    sectionTitle: {
        ...Typography.body1,
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
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    optionButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    optionText: {
        fontSize: 14,
        color: Colors.textSecondary,
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
        backgroundColor: Colors.surface,
        padding: Spacing.m,
        borderRadius: Layout.borderRadius.l,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    toggleTitle: {
        ...Typography.body1,
        fontWeight: '600',
        marginBottom: 4,
    },
    toggleDescription: {
        ...Typography.caption,
        color: Colors.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginVertical: Spacing.l,
    },
});
