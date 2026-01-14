import React, { useRef, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Text,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Layout, Spacing, Typography } from '../constants/theme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

interface TabItemConfig {
    icon: keyof typeof Ionicons.glyphMap;
    iconFocused: keyof typeof Ionicons.glyphMap;
    label: string;
}

const TAB_CONFIG: Record<string, TabItemConfig> = {
    Dashboard: { icon: 'home-outline', iconFocused: 'home', label: '홈' },
    VideoLectures: { icon: 'play-circle-outline', iconFocused: 'play-circle', label: '동강' },
    Courses: { icon: 'book-outline', iconFocused: 'book', label: '강의' },
    Settings: { icon: 'cog-outline', iconFocused: 'cog', label: '설정' },
};

interface TabItemProps {
    route: any;
    index: number;
    state: any;
    descriptors: any;
    navigation: any;
    badge?: number;
}

function TabItem({ route, index, state, descriptors, navigation, badge }: TabItemProps) {
    const isFocused = state.index === index;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

    const config = TAB_CONFIG[route.name] || {
        icon: 'ellipse-outline',
        iconFocused: 'ellipse',
        label: route.name,
    };

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: isFocused ? 1 : 0.95,
                useNativeDriver: true,
                speed: 20,
                bounciness: 8,
            }),
            Animated.timing(opacityAnim, {
                toValue: isFocused ? 1 : 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, [isFocused, scaleAnim, opacityAnim]);

    const onPress = () => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
        }
    };

    const onLongPress = () => {
        navigation.emit({
            type: 'tabLongPress',
            target: route.key,
        });
    };

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.7}
        >
            <Animated.View
                style={[
                    styles.tabItemContent,
                    { transform: [{ scale: scaleAnim }] },
                ]}
            >
                {/* Background pill for focused state */}
                <Animated.View
                    style={[
                        styles.focusPill,
                        { opacity: opacityAnim },
                    ]}
                />

                <View style={styles.iconContainer}>
                    <Ionicons
                        name={isFocused ? config.iconFocused : config.icon}
                        size={24}
                        color={isFocused ? Colors.primary : Colors.textTertiary}
                    />
                    {badge !== undefined && badge > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {badge > 99 ? '99+' : badge}
                            </Text>
                        </View>
                    )}
                </View>

                <Text
                    style={[
                        styles.label,
                        isFocused && styles.labelFocused,
                    ]}
                >
                    {config.label}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

interface CustomTabBarProps extends BottomTabBarProps {
    badges?: Record<string, number>;
}

export default function CustomTabBar({ state, descriptors, navigation, badges = {} }: CustomTabBarProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <View style={styles.tabBar}>
                {state.routes.map((route: any, index: number) => (
                    <TabItem
                        key={route.key}
                        route={route}
                        index={index}
                        state={state}
                        descriptors={descriptors}
                        navigation={navigation}
                        badge={badges[route.name]}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.borderLight,
        ...Platform.select({
            ios: {
                shadowColor: Colors.textPrimary,
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    tabBar: {
        flexDirection: 'row',
        height: 64,
        paddingHorizontal: Spacing.s,
    },
    tabItem: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabItemContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.m,
        position: 'relative',
    },
    focusPill: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Colors.primaryLighter,
        borderRadius: Layout.borderRadius.l,
    },
    iconContainer: {
        position: 'relative',
        marginBottom: 2,
    },
    label: {
        fontSize: 11,
        fontWeight: '500',
        color: Colors.textTertiary,
        marginTop: 2,
    },
    labelFocused: {
        color: Colors.primary,
        fontWeight: '600',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -10,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.error,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: Colors.surface,
    },
    badgeText: {
        color: Colors.textInverse,
        fontSize: 10,
        fontWeight: '700',
    },
});
