import React, { useState, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { useUser } from './context/UserContext';
import { useToast } from './context/ToastContext';

export default function MyInfoScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const navigation = useNavigation();
    const { profile, updateName } = useUser();
    const { showSuccess, showError } = useToast();
    const [name, setName] = useState(profile.name);
    const [isFocused, setIsFocused] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Animations
    const inputScale = useRef(new Animated.Value(1)).current;

    const hasChanges = name !== profile.name;

    const handleFocus = () => {
        setIsFocused(true);
        Animated.spring(inputScale, {
            toValue: 1.02,
            useNativeDriver: true,
            speed: 20,
            bounciness: 4,
        }).start();
    };

    const handleBlur = () => {
        setIsFocused(false);
        Animated.spring(inputScale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 4,
        }).start();
    };

    const handleSave = async () => {
        if (!hasChanges) return;

        setIsSaving(true);
        try {
            await updateName(name.trim());
            showSuccess('저장 완료', '이름이 저장되었습니다.');
            navigation.goBack();
        } catch (e) {
            showError('오류', '저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    {/* Profile Avatar */}
                    <View style={styles.avatarSection}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatar}>
                                {name ? (
                                    <Text style={styles.avatarText}>
                                        {name.charAt(0).toUpperCase()}
                                    </Text>
                                ) : (
                                    <Ionicons name="person" size={40} color={colors.primary} />
                                )}
                            </View>
                            <View style={styles.avatarGlow} />
                        </View>
                        <Text style={styles.avatarHint}>
                            {name ? `안녕하세요, ${name}님` : '이름을 입력해주세요'}
                        </Text>
                    </View>

                    {/* Form Section */}
                    <View style={styles.formSection}>
                        <Text style={styles.label}>이름</Text>
                        <Text style={styles.labelHint}>대시보드 인사말에 표시됩니다</Text>

                        <Animated.View
                            style={[
                                styles.inputContainer,
                                isFocused && styles.inputContainerFocused,
                                { transform: [{ scale: inputScale }] },
                            ]}
                        >
                            <View style={styles.inputIcon}>
                                <Ionicons
                                    name="person-outline"
                                    size={20}
                                    color={isFocused ? colors.primary : colors.textTertiary}
                                />
                            </View>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="이름을 입력하세요"
                                placeholderTextColor={colors.textTertiary}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                maxLength={20}
                                autoCapitalize="words"
                                returnKeyType="done"
                                onSubmitEditing={handleSave}
                            />
                            {name.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setName('')}
                                    style={styles.clearButton}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </Animated.View>

                        <Text style={styles.charCount}>{name.length}/20</Text>
                    </View>

                    {/* Info Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="information-circle" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.infoText}>
                            이름은 기기에만 저장되며 외부로 전송되지 않습니다.
                        </Text>
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            !hasChanges && styles.saveButtonDisabled,
                            isSaving && styles.saveButtonLoading,
                        ]}
                        onPress={handleSave}
                        disabled={!hasChanges || isSaving}
                        activeOpacity={0.8}
                    >
                        <Text style={[
                            styles.saveButtonText,
                            !hasChanges && styles.saveButtonTextDisabled,
                        ]}>
                            {isSaving ? '저장 중...' : '저장하기'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.xl,
    },

    // Avatar Section
    avatarSection: {
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: Spacing.m,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 32,
        backgroundColor: colors.primaryLighter,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.surface,
        ...layout.shadow.md,
    },
    avatarText: {
        fontSize: 42,
        fontWeight: '700',
        color: colors.primary,
    },
    avatarGlow: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 36,
        backgroundColor: colors.primaryGlow,
        zIndex: -1,
    },
    avatarHint: {
        ...typography.body1,
        color: colors.textSecondary,
        textAlign: 'center',
    },

    // Form Section
    formSection: {
        marginBottom: Spacing.xl,
    },
    label: {
        ...typography.subtitle1,
        marginBottom: 4,
    },
    labelHint: {
        ...typography.caption,
        color: colors.textTertiary,
        marginBottom: Spacing.m,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.l,
        borderWidth: 2,
        borderColor: colors.border,
        paddingHorizontal: Spacing.m,
        ...layout.shadow.sm,
    },
    inputContainerFocused: {
        borderColor: colors.primary,
        backgroundColor: colors.surface,
        ...layout.shadow.primary,
    },
    inputIcon: {
        marginRight: Spacing.s,
    },
    input: {
        flex: 1,
        ...typography.body1,
        paddingVertical: Spacing.m,
        color: colors.textPrimary,
    },
    clearButton: {
        padding: Spacing.xs,
    },
    charCount: {
        ...typography.caption,
        color: colors.textTertiary,
        textAlign: 'right',
        marginTop: Spacing.s,
    },

    // Info Card
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.primaryLighter,
        borderRadius: layout.borderRadius.m,
        padding: Spacing.m,
        marginBottom: Spacing.xxl,
    },
    infoIcon: {
        marginRight: Spacing.s,
        marginTop: 2,
    },
    infoText: {
        flex: 1,
        ...typography.body2,
        color: colors.textSecondary,
        lineHeight: 20,
    },

    // Save Button
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: layout.borderRadius.l,
        paddingVertical: Spacing.m,
        alignItems: 'center',
        justifyContent: 'center',
        ...layout.shadow.primary,
    },
    saveButtonDisabled: {
        backgroundColor: colors.surfaceMuted,
        ...layout.shadow.sm,
    },
    saveButtonLoading: {
        opacity: 0.8,
    },
    saveButtonText: {
        ...typography.button,
        color: colors.textInverse,
    },
    saveButtonTextDisabled: {
        color: colors.textTertiary,
    },
});
