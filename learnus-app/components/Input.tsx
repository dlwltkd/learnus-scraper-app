import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    TextInput,
    View,
    Text,
    ViewStyle,
    TextStyle,
    Animated,
    TouchableOpacity,
    TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: keyof typeof Ionicons.glyphMap;
    rightIcon?: keyof typeof Ionicons.glyphMap;
    onRightIconPress?: () => void;
    containerStyle?: ViewStyle;
    inputStyle?: TextStyle;
    variant?: 'default' | 'filled' | 'outline';
    size?: 'sm' | 'md' | 'lg';
}

export default function Input({
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    inputStyle,
    variant = 'default',
    size = 'md',
    secureTextEntry,
    ...props
}: InputProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const focusAnim = useRef(new Animated.Value(0)).current;

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        Animated.spring(focusAnim, {
            toValue: 1,
            useNativeDriver: false,
            speed: 20,
            bounciness: 4,
        }).start();
    }, [focusAnim]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        Animated.spring(focusAnim, {
            toValue: 0,
            useNativeDriver: false,
            speed: 20,
            bounciness: 4,
        }).start();
    }, [focusAnim]);

    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return {
                    container: { paddingVertical: 10, paddingHorizontal: 12 },
                    text: { fontSize: 14 },
                    icon: 18,
                };
            case 'lg':
                return {
                    container: { paddingVertical: 18, paddingHorizontal: 18 },
                    text: { fontSize: 17 },
                    icon: 24,
                };
            default:
                return {
                    container: { paddingVertical: 14, paddingHorizontal: 16 },
                    text: { fontSize: 16 },
                    icon: 20,
                };
        }
    };

    const getVariantStyles = () => {
        const hasError = !!error;

        switch (variant) {
            case 'filled':
                return {
                    container: {
                        backgroundColor: isFocused ? colors.surface : colors.surfaceMuted,
                        borderWidth: 2,
                        borderColor: hasError
                            ? colors.error
                            : isFocused
                                ? colors.primary
                                : 'transparent',
                    },
                };
            case 'outline':
                return {
                    container: {
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderColor: hasError
                            ? colors.error
                            : isFocused
                                ? colors.primary
                                : colors.border,
                    },
                };
            default:
                return {
                    container: {
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: hasError
                            ? colors.error
                            : isFocused
                                ? colors.primary
                                : colors.border,
                    },
                };
        }
    };

    const sizeStyles = getSizeStyles();
    const variantStyles = getVariantStyles();

    const borderWidth = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [variant === 'default' ? 1 : 2, 2],
    });

    const showPasswordToggle = secureTextEntry !== undefined;
    const actualSecureEntry = secureTextEntry && !isPasswordVisible;

    return (
        <View style={[styles.wrapper, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}

            <Animated.View
                style={[
                    styles.inputContainer,
                    sizeStyles.container,
                    variantStyles.container,
                    { borderRadius: layout.borderRadius.m },
                    isFocused && !error && layout.shadow.sm,
                ]}
            >
                {leftIcon && (
                    <Ionicons
                        name={leftIcon}
                        size={sizeStyles.icon}
                        color={isFocused ? colors.primary : colors.textTertiary}
                        style={styles.leftIcon}
                    />
                )}

                <TextInput
                    style={[
                        styles.input,
                        sizeStyles.text,
                        inputStyle,
                    ]}
                    placeholderTextColor={colors.textTertiary}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    secureTextEntry={actualSecureEntry}
                    {...props}
                />

                {showPasswordToggle && (
                    <TouchableOpacity
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        style={styles.rightIconButton}
                    >
                        <Ionicons
                            name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                            size={sizeStyles.icon}
                            color={colors.textTertiary}
                        />
                    </TouchableOpacity>
                )}

                {rightIcon && !showPasswordToggle && (
                    <TouchableOpacity
                        onPress={onRightIconPress}
                        disabled={!onRightIconPress}
                        style={styles.rightIconButton}
                    >
                        <Ionicons
                            name={rightIcon}
                            size={sizeStyles.icon}
                            color={colors.textTertiary}
                        />
                    </TouchableOpacity>
                )}
            </Animated.View>

            {(error || hint) && (
                <Text style={[styles.helperText, error && styles.errorText]}>
                    {error || hint}
                </Text>
            )}
        </View>
    );
}

// Search Input variant
interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'variant'> {
    onClear?: () => void;
}

export function SearchInput({ value, onClear, ...props }: SearchInputProps) {
    return (
        <Input
            leftIcon="search"
            rightIcon={value ? 'close-circle' : undefined}
            onRightIconPress={onClear}
            variant="filled"
            placeholder="Search..."
            {...props}
            value={value}
        />
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    wrapper: {
        marginBottom: Spacing.m,
    },
    label: {
        ...typography.label,
        marginBottom: Spacing.xs,
        marginLeft: Spacing.xxs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        color: colors.textPrimary,
        padding: 0,
        margin: 0,
    },
    leftIcon: {
        marginRight: Spacing.s,
    },
    rightIconButton: {
        marginLeft: Spacing.s,
        padding: 2,
    },
    helperText: {
        ...typography.caption,
        marginTop: Spacing.xs,
        marginLeft: Spacing.xxs,
    },
    errorText: {
        color: colors.error,
    },
});
