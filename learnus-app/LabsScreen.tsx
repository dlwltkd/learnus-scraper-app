import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { useLabs } from './context/LabsContext';
import { useToast } from './context/ToastContext';

export default function LabsScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const { autoWatchEnabled, setAutoWatchEnabled, brainEnabled, setBrainEnabled, isLoading } = useLabs();
    const { showError } = useToast();
    const [saving, setSaving] = useState(false);
    const [savingBrain, setSavingBrain] = useState(false);

    const handleToggle = async (enabled: boolean) => {
        setSaving(true);
        try {
            await setAutoWatchEnabled(enabled);
        } catch (e) {
            showError('오류', '설정을 저장할 수 없어요. 다시 시도해주세요.');
        } finally {
            setSaving(false);
        }
    };

    const handleBrainToggle = async (enabled: boolean) => {
        setSavingBrain(true);
        try {
            await setBrainEnabled(enabled);
        } catch (e) {
            showError('오류', '설정을 저장할 수 없어요. 다시 시도해주세요.');
        } finally {
            setSavingBrain(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={styles.headerIcon}>
                        <Ionicons name="flask" size={28} color={colors.primary} />
                    </View>
                    {/* One line, and allowed to shrink to stay there. At large system
                        font scales this wrapped, stranding "옵션" on its own line;
                        capping lines alone just traded that for a "개발자 옵…" ellipsis,
                        so the text needs room to scale down instead. */}
                    <Text
                        style={styles.title}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                    >
                        개발자 옵션
                    </Text>
                    <Text style={styles.subtitle}>개발 및 테스트용 실험실 기능입니다.</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.toggleText}>
                        <Text style={styles.toggleTitle}>자동 시청 기능</Text>
                        <Text style={styles.toggleDescription}>
                            VOD 화면의 모두 시청 버튼과 강의별 자동 시청 메뉴를 표시합니다.
                        </Text>
                    </View>
                    <Switch
                        value={autoWatchEnabled}
                        onValueChange={handleToggle}
                        disabled={saving}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#fff"
                    />
                </View>

                {/* Separate from 자동 시청 on purpose: turning this on authorises the app to
                    transcribe lectures and spend API credit, which is a different decision
                    from showing a watch button. The description says so plainly. */}
                <View style={styles.card}>
                    <View style={styles.toggleText}>
                        <Text style={styles.toggleTitle}>강의 브레인</Text>
                        <Text style={styles.toggleDescription}>
                            강의 자료·동영상·과제를 학습해 질문에 답하고, 주차별로 정리해서 보여줘요.
                            만들 때 강의를 자동으로 텍스트 변환하며 시간이 걸려요.
                        </Text>
                    </View>
                    <Switch
                        value={brainEnabled}
                        onValueChange={handleBrainToggle}
                        disabled={savingBrain}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#fff"
                    />
                </View>

                <View style={styles.warningCard}>
                    <View style={styles.warningHeader}>
                        <Ionicons name="warning" size={18} color={colors.warning} />
                        <Text style={styles.warningTitle}>주의사항</Text>
                    </View>
                    <Text style={styles.warningText}>이 기능은 개발 및 테스트 용도로만 제공됩니다.</Text>
                    <Text style={styles.warningText}>실제 출석 또는 학습 기록 반영을 보장하지 않습니다.</Text>
                    <Text style={styles.warningText}>학교 정책 및 강의 설정에 따라 예상과 다르게 동작할 수 있습니다.</Text>
                    <Text style={styles.warningText}>기본값은 꺼짐이며, 사용자가 직접 켜야 합니다.</Text>
                </View>
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
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
    },
    content: {
        padding: Spacing.l,
        paddingBottom: Spacing.xxl,
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    headerIcon: {
        width: 64,
        height: 64,
        borderRadius: 18,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.m,
    },
    title: {
        ...typography.header2,
        marginBottom: 4,
    },
    subtitle: {
        ...typography.body2,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        padding: Spacing.l,
        marginBottom: Spacing.l,
        ...layout.shadow.sm,
    },
    toggleText: {
        flex: 1,
        marginRight: Spacing.m,
    },
    toggleTitle: {
        ...typography.subtitle1,
        marginBottom: 4,
    },
    toggleDescription: {
        ...typography.caption,
        lineHeight: 18,
    },
    warningCard: {
        backgroundColor: isDark ? colors.surface : '#FFF8E6',
        borderRadius: layout.borderRadius.l,
        borderWidth: 1,
        borderColor: colors.warning + '55',
        padding: Spacing.l,
    },
    warningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: Spacing.s,
    },
    warningTitle: {
        ...typography.subtitle1,
        color: colors.textPrimary,
    },
    warningText: {
        ...typography.body2,
        color: colors.textSecondary,
        lineHeight: 21,
        marginTop: 6,
    },
});
