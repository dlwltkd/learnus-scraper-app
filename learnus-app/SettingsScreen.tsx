import React, { useRef, useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Linking,
    Modal,
    Platform,
    ActionSheetIOS,
} from 'react-native';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import type { ThemeMode } from './context/ThemeContext';
import { APP_VERSION } from './constants/version';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './context/AuthContext';
import { useUser } from './context/UserContext';
import { useToast } from './context/ToastContext';
import { useTour, resetTour } from './context/TourContext';
import { ScreenHeader } from './components/Header';

// ============================================
// SETTING ITEM COMPONENT
// ============================================
interface SettingItemProps {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    isDestructive?: boolean;
    showChevron?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
}

const SettingItem = ({
    icon,
    iconColor,
    title,
    subtitle,
    onPress,
    isDestructive = false,
    showChevron = true,
    isFirst = false,
    isLast = false,
}: SettingItemProps) => {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const scaleAnim = useRef(new Animated.Value(1)).current;

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

    const color = isDestructive ? colors.error : (iconColor || colors.primary);

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                style={[
                    styles.settingItem,
                    isFirst && styles.settingItemFirst,
                    isLast && styles.settingItemLast,
                    !isLast && styles.settingItemBorder,
                ]}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
            >
                <View style={[styles.settingIconContainer, { backgroundColor: color + '15' }]}>
                    <Ionicons name={icon} size={20} color={color} />
                </View>

                <View style={styles.settingContent}>
                    <Text style={[styles.settingTitle, isDestructive && styles.settingTitleDestructive]}>
                        {title}
                    </Text>
                    {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
                </View>

                {showChevron && (
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

// ============================================
// SETTING SECTION COMPONENT
// ============================================
interface SettingSectionProps {
    title: string;
    children: React.ReactNode;
}

const SettingSection = ({ title, children }: SettingSectionProps) => {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionCard}>{children}</View>
        </View>
    );
};

// ============================================
// MAIN SETTINGS SCREEN
// ============================================
export default function SettingsScreen() {
    const { colors, typography, layout, isDark, themeMode, setThemeMode } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const navigation = useNavigation();
    const { logout } = useAuth();
    const { profile } = useUser();
    const { showConfirm, showInfo, showSuccess } = useToast();
    const { startTour } = useTour();
    const [showThemeModal, setShowThemeModal] = useState(false);

    const handleReplayTour = async () => {
        await resetTour();
        startTour();
    };

    const handleLogout = () => {
        showConfirm(
            '로그아웃',
            '정말 로그아웃 하시겠습니까?',
            () => logout(),
            '로그아웃',
            '취소'
        );
    };

    const handleComingSoon = (feature: string) => {
        showInfo('알림', `${feature} 기능은 현재 개발 중입니다.`);
    };

    const THEME_MODES: { mode: ThemeMode; label: string }[] = [
        { mode: 'system', label: '시스템' },
        { mode: 'light', label: '라이트' },
        { mode: 'dark', label: '다크' },
    ];

    const currentThemeLabel = THEME_MODES.find(t => t.mode === themeMode)?.label ?? '시스템';

    const handleThemePress = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [...THEME_MODES.map(t => t.label), '취소'],
                    cancelButtonIndex: THEME_MODES.length,
                    title: '테마 선택',
                },
                (buttonIndex) => {
                    if (buttonIndex < THEME_MODES.length) {
                        setThemeMode(THEME_MODES[buttonIndex].mode);
                    }
                }
            );
        } else {
            setShowThemeModal(true);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Theme Picker Modal (Android) */}
            <Modal
                visible={showThemeModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowThemeModal(false)}
            >
                <TouchableOpacity
                    style={styles.themeModalBackdrop}
                    activeOpacity={1}
                    onPress={() => setShowThemeModal(false)}
                >
                    <View style={styles.themeModalContent}>
                        <Text style={styles.themeModalTitle}>테마 선택</Text>
                        {THEME_MODES.map(({ mode, label }) => (
                            <TouchableOpacity
                                key={mode}
                                style={[styles.themeOption, themeMode === mode && styles.themeOptionSelected]}
                                onPress={() => { setThemeMode(mode); setShowThemeModal(false); }}
                            >
                                <Text style={[styles.themeOptionText, themeMode === mode && styles.themeOptionTextSelected]}>
                                    {label}
                                </Text>
                                {themeMode === mode && (
                                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <ScreenHeader title="설정" />

                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.profileAvatar}>
                        {profile.name ? (
                            <Text style={styles.profileAvatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
                        ) : (
                            <Ionicons name="person" size={32} color={colors.primary} />
                        )}
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{profile.name || 'LearnUs 사용자'}</Text>
                        <Text style={styles.profileEmail}>연세대학교</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.profileEditButton}
                        onPress={() => (navigation as any).navigate('MyInfo')}
                    >
                        <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Account Section */}
                <SettingSection title="계정">
                    <SettingItem
                        icon="person-outline"
                        iconColor={colors.primary}
                        title="내 정보"
                        subtitle="프로필 및 계정 정보"
                        onPress={() => (navigation as any).navigate('MyInfo')}
                        isFirst
                    />
                    <SettingItem
                        icon="notifications-outline"
                        iconColor={colors.warning}
                        title="알림 설정"
                        subtitle="푸시 알림 관리"
                        onPress={() => (navigation as any).navigate('NotificationSettings')}
                        isLast
                    />
                </SettingSection>

                {/* App Section */}
                <SettingSection title="앱">
                    <SettingItem
                        icon="color-palette-outline"
                        iconColor={colors.secondary}
                        title="테마"
                        subtitle={currentThemeLabel}
                        onPress={handleThemePress}
                        isFirst
                    />
                    <SettingItem
                        icon="language-outline"
                        iconColor={colors.tertiary}
                        title="언어"
                        subtitle="한국어"
                        onPress={() => handleComingSoon('언어')}
                    />
                    <SettingItem
                        icon="map-outline"
                        iconColor={colors.accent}
                        title="앱 둘러보기"
                        subtitle="주요 기능 가이드 다시 보기"
                        onPress={handleReplayTour}
                        isLast
                    />
                </SettingSection>

                {/* Support Section */}
                <SettingSection title="지원">
                    <SettingItem
                        icon="help-circle-outline"
                        iconColor={colors.success}
                        title="도움말"
                        subtitle="사용 가이드 및 FAQ"
                        onPress={() => (navigation as any).navigate('Help')}
                        isFirst
                    />
                    <SettingItem
                        icon="chatbubble-outline"
                        iconColor={colors.primary}
                        title="피드백 보내기"
                        onPress={() => Linking.openURL('mailto:dlwltkd@yonsei.ac.kr')}
                    />
                    <SettingItem
                        icon="document-text-outline"
                        iconColor={colors.textSecondary}
                        title="이용약관"
                        onPress={() => (navigation as any).navigate('TermsOfService')}
                    />
                    <SettingItem
                        icon="shield-checkmark-outline"
                        iconColor={colors.textSecondary}
                        title="개인정보 처리방침"
                        onPress={() => (navigation as any).navigate('PrivacyPolicy')}
                        isLast
                    />
                </SettingSection>

                {/* Danger Zone */}
                <SettingSection title="">
                    <SettingItem
                        icon="log-out-outline"
                        title="로그아웃"
                        onPress={handleLogout}
                        isDestructive
                        showChevron={false}
                        isFirst
                        isLast
                    />
                </SettingSection>

                {/* App Version */}
                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>LearnUs Connect</Text>
                    <Text style={styles.versionNumber}>버전 {APP_VERSION}</Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    scrollContent: {
        paddingBottom: Spacing.xxl,
    },

    // Profile Section
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: Spacing.l,
        marginBottom: Spacing.xl,
        padding: Spacing.l,
        borderRadius: layout.borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        ...layout.shadow.default,
    },
    profileAvatar: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    profileAvatarText: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.primary,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        ...typography.header3,
        marginBottom: 2,
    },
    profileEmail: {
        ...typography.body2,
    },
    profileEditButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Section
    section: {
        marginHorizontal: Spacing.l,
        marginBottom: Spacing.l,
    },
    sectionTitle: {
        ...typography.overline,
        color: colors.textTertiary,
        marginBottom: Spacing.s,
        marginLeft: Spacing.xs,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        ...layout.shadow.sm,
    },

    // Setting Item
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.m,
        backgroundColor: colors.surface,
    },
    settingItemFirst: {
        borderTopLeftRadius: layout.borderRadius.l,
        borderTopRightRadius: layout.borderRadius.l,
    },
    settingItemLast: {
        borderBottomLeftRadius: layout.borderRadius.l,
        borderBottomRightRadius: layout.borderRadius.l,
    },
    settingItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    settingIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    settingContent: {
        flex: 1,
        marginRight: Spacing.s,
    },
    settingTitle: {
        ...typography.subtitle1,
        fontSize: 15,
    },
    settingTitleDestructive: {
        color: colors.error,
    },
    settingSubtitle: {
        ...typography.caption,
        marginTop: 2,
    },

    // Version
    versionContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    versionText: {
        ...typography.body2,
        color: colors.textTertiary,
    },
    versionNumber: {
        ...typography.caption,
        color: colors.textTertiary,
        marginTop: 2,
    },

    // Theme Modal
    themeModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    themeModalContent: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.xl,
        padding: Spacing.l,
        marginHorizontal: Spacing.l,
        minWidth: 240,
        ...layout.shadow.lg,
    },
    themeModalTitle: {
        ...typography.header3,
        textAlign: 'center',
        marginBottom: Spacing.m,
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.m,
        paddingHorizontal: Spacing.s,
        borderRadius: layout.borderRadius.m,
    },
    themeOptionSelected: {
        backgroundColor: colors.primaryLighter,
    },
    themeOptionText: {
        ...typography.subtitle1,
        fontSize: 15,
        color: colors.textPrimary,
    },
    themeOptionTextSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
});
