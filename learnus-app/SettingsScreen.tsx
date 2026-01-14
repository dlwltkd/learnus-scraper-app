import React, { useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
    Animated,
    Linking,
} from 'react-native';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './context/AuthContext';
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

    const color = isDestructive ? Colors.error : (iconColor || Colors.primary);

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
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
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

const SettingSection = ({ title, children }: SettingSectionProps) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionCard}>{children}</View>
    </View>
);

// ============================================
// MAIN SETTINGS SCREEN
// ============================================
export default function SettingsScreen() {
    const navigation = useNavigation();
    const { logout } = useAuth();

    const handleLogout = () => {
        Alert.alert(
            '로그아웃',
            '정말 로그아웃 하시겠습니까?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '로그아웃',
                    style: 'destructive',
                    onPress: () => logout(),
                },
            ]
        );
    };

    const handleComingSoon = (feature: string) => {
        Alert.alert('알림', `${feature} 기능은 현재 개발 중입니다.`);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <ScreenHeader title="설정" />

                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.profileAvatar}>
                        <Ionicons name="person" size={32} color={Colors.primary} />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>LearnUs 사용자</Text>
                        <Text style={styles.profileEmail}>연세대학교</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.profileEditButton}
                        onPress={() => handleComingSoon('내 정보')}
                    >
                        <Ionicons name="pencil" size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Account Section */}
                <SettingSection title="계정">
                    <SettingItem
                        icon="person-outline"
                        iconColor={Colors.primary}
                        title="내 정보"
                        subtitle="프로필 및 계정 정보"
                        onPress={() => handleComingSoon('내 정보')}
                        isFirst
                    />
                    <SettingItem
                        icon="notifications-outline"
                        iconColor={Colors.warning}
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
                        iconColor={Colors.secondary}
                        title="테마"
                        subtitle="라이트 모드"
                        onPress={() => handleComingSoon('테마')}
                        isFirst
                    />
                    <SettingItem
                        icon="language-outline"
                        iconColor={Colors.tertiary}
                        title="언어"
                        subtitle="한국어"
                        onPress={() => handleComingSoon('언어')}
                        isLast
                    />
                </SettingSection>

                {/* Support Section */}
                <SettingSection title="지원">
                    <SettingItem
                        icon="help-circle-outline"
                        iconColor={Colors.success}
                        title="도움말"
                        subtitle="사용 가이드 및 FAQ"
                        onPress={() => (navigation as any).navigate('Help')}
                        isFirst
                    />
                    <SettingItem
                        icon="chatbubble-outline"
                        iconColor={Colors.primary}
                        title="피드백 보내기"
                        onPress={() => Linking.openURL('mailto:support@example.com')}
                    />
                    <SettingItem
                        icon="document-text-outline"
                        iconColor={Colors.textSecondary}
                        title="이용약관"
                        onPress={() => handleComingSoon('이용약관')}
                    />
                    <SettingItem
                        icon="shield-checkmark-outline"
                        iconColor={Colors.textSecondary}
                        title="개인정보 처리방침"
                        onPress={() => handleComingSoon('개인정보 처리방침')}
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
                    <Text style={styles.versionNumber}>버전 1.0.0</Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingBottom: Spacing.xxl,
    },

    // Profile Section
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        marginHorizontal: Spacing.l,
        marginBottom: Spacing.xl,
        padding: Spacing.l,
        borderRadius: Layout.borderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.default,
    },
    profileAvatar: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: Colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        ...Typography.header3,
        marginBottom: 2,
    },
    profileEmail: {
        ...Typography.body2,
    },
    profileEditButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: Colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Section
    section: {
        marginHorizontal: Spacing.l,
        marginBottom: Spacing.l,
    },
    sectionTitle: {
        ...Typography.overline,
        color: Colors.textTertiary,
        marginBottom: Spacing.s,
        marginLeft: Spacing.xs,
    },
    sectionCard: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.l,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        ...Layout.shadow.sm,
    },

    // Setting Item
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.m,
        backgroundColor: Colors.surface,
    },
    settingItemFirst: {
        borderTopLeftRadius: Layout.borderRadius.l,
        borderTopRightRadius: Layout.borderRadius.l,
    },
    settingItemLast: {
        borderBottomLeftRadius: Layout.borderRadius.l,
        borderBottomRightRadius: Layout.borderRadius.l,
    },
    settingItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
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
        ...Typography.subtitle1,
        fontSize: 15,
    },
    settingTitleDestructive: {
        color: Colors.error,
    },
    settingSubtitle: {
        ...Typography.caption,
        marginTop: 2,
    },

    // Version
    versionContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    versionText: {
        ...Typography.body2,
        color: Colors.textTertiary,
    },
    versionNumber: {
        ...Typography.caption,
        color: Colors.textTertiary,
        marginTop: 2,
    },
});
