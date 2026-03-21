import React, { useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    ViewStyle,
    TextStyle,
    ActivityIndicator,
    Animated,
    View,
} from 'react-native';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    rounded?: boolean;
}

export default function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    style,
    textStyle,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    rounded = false,
}: ButtonProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim]);

    const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
        switch (size) {
            case 'sm':
                return {
                    container: {
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderRadius: rounded ? layout.borderRadius.full : layout.borderRadius.s,
                    },
                    text: {
                        fontSize: 13,
                        fontWeight: '600',
                    },
                };
            case 'lg':
                return {
                    container: {
                        paddingVertical: 18,
                        paddingHorizontal: 28,
                        borderRadius: rounded ? layout.borderRadius.full : layout.borderRadius.l,
                    },
                    text: {
                        fontSize: 17,
                        fontWeight: '600',
                    },
                };
            default: // md
                return {
                    container: {
                        paddingVertical: 14,
                        paddingHorizontal: 22,
                        borderRadius: rounded ? layout.borderRadius.full : layout.borderRadius.m,
                    },
                    text: {
                        fontSize: 15,
                        fontWeight: '600',
                    },
                };
        }
    };

    const getVariantStyles = (): { container: ViewStyle; text: TextStyle; shadow?: object } => {
        if (disabled) {
            return {
                container: {
                    backgroundColor: colors.surfaceMuted,
                },
                text: {
                    color: colors.textTertiary,
                },
            };
        }

        switch (variant) {
            case 'primary':
                return {
                    container: {
                        backgroundColor: colors.primary,
                    },
                    text: {
                        color: colors.textInverse,
                    },
                    shadow: layout.shadow.primary,
                };
            case 'secondary':
                return {
                    container: {
                        backgroundColor: colors.primaryLighter,
                    },
                    text: {
                        color: colors.primary,
                    },
                    shadow: layout.shadow.sm,
                };
            case 'outline':
                return {
                    container: {
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        borderColor: colors.border,
                    },
                    text: {
                        color: colors.textPrimary,
                    },
                };
            case 'ghost':
                return {
                    container: {
                        backgroundColor: 'transparent',
                    },
                    text: {
                        color: colors.textSecondary,
                    },
                };
            case 'danger':
                return {
                    container: {
                        backgroundColor: colors.error,
                    },
                    text: {
                        color: colors.textInverse,
                    },
                    shadow: layout.shadow.error,
                };
            case 'success':
                return {
                    container: {
                        backgroundColor: colors.success,
                    },
                    text: {
                        color: colors.textInverse,
                    },
                    shadow: layout.shadow.sm,
                };
            default:
                return {
                    container: {},
                    text: {},
                };
        }
    };

    const sizeStyles = getSizeStyles();
    const variantStyles = getVariantStyles();
    const isDisabled = disabled || loading;

    const content = (
        <>
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variantStyles.text.color}
                    style={styles.loader}
                />
            ) : (
                <View style={styles.contentWrapper}>
                    {icon && iconPosition === 'left' && (
                        <View style={styles.iconLeft}>{icon}</View>
                    )}
                    <Text
                        style={[
                            styles.text,
                            sizeStyles.text,
                            variantStyles.text,
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                    {icon && iconPosition === 'right' && (
                        <View style={styles.iconRight}>{icon}</View>
                    )}
                </View>
            )}
        </>
    );

    return (
        <Animated.View
            style={[
                { transform: [{ scale: scaleAnim }] },
                fullWidth && styles.fullWidth,
            ]}
        >
            <TouchableOpacity
                style={[
                    styles.button,
                    sizeStyles.container,
                    variantStyles.container,
                    !isDisabled && variantStyles.shadow,
                    fullWidth && styles.fullWidth,
                    style,
                ]}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isDisabled}
                activeOpacity={0.9}
            >
                {content}
            </TouchableOpacity>
        </Animated.View>
    );
}

// Icon Button variant for icon-only buttons
interface IconButtonProps {
    icon: React.ReactNode;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    style?: ViewStyle;
}

export function IconButton({
    icon,
    onPress,
    variant = 'ghost',
    size = 'md',
    disabled = false,
    style,
}: IconButtonProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.92,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scaleAnim]);

    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return { width: 36, height: 36, borderRadius: 10 };
            case 'lg':
                return { width: 52, height: 52, borderRadius: 16 };
            default:
                return { width: 44, height: 44, borderRadius: 12 };
        }
    };

    const getVariantStyles = () => {
        if (disabled) {
            return { backgroundColor: colors.surfaceMuted };
        }
        switch (variant) {
            case 'primary':
                return { backgroundColor: colors.primary };
            case 'secondary':
                return { backgroundColor: colors.primaryLighter };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderColor: colors.border,
                };
            default:
                return { backgroundColor: colors.surfaceHighlight };
        }
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                style={[
                    styles.iconButton,
                    getSizeStyles(),
                    getVariantStyles(),
                    !disabled && variant === 'primary' && layout.shadow.primary,
                    style,
                ]}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled}
                activeOpacity={0.8}
            >
                {icon}
            </TouchableOpacity>
        </Animated.View>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    fullWidth: {
        width: '100%',
    },
    contentWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    iconLeft: {
        marginRight: 8,
    },
    iconRight: {
        marginLeft: 8,
    },
    loader: {
        marginVertical: 2,
    },
    iconButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
