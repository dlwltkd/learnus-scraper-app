import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    StatusBar,
    Platform,
    Animated,
    TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { loginWithCookies } from './services/api';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import Button from './components/Button';

interface LoginScreenProps {
    onLoginSuccess: (token: string) => Promise<boolean>;
    autoLogout?: boolean;
    onAutoLogoutComplete?: () => void;
}

export default function LoginScreen({
    onLoginSuccess,
    autoLogout,
    onAutoLogoutComplete,
}: LoginScreenProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const isLoggingOutRef = useRef(false);

    // WebView State
    const [url, setUrl] = useState('https://ys.learnus.org/login/index.php');
    const webViewRef = useRef<WebView>(null);
    const hasLoggedOut = useRef(false);
    const currentUrlRef = useRef('https://ys.learnus.org/login/index.php');

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    useEffect(() => {
        if (autoLogout) {
            console.log('Auto-logout triggered. Clearing cookies.');
            setIsLoggingOut(true);
            isLoggingOutRef.current = true;
            setTimeout(() => {
                const clearCookieScript = `
                    (function() {
                        var cookies = document.cookie.split(";");
                        for (var i = 0; i < cookies.length; i++) {
                            var cookie = cookies[i];
                            var eqPos = cookie.indexOf("=");
                            var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                            name = name.replace(/^ +/, "");
                            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.learnus.org";
                            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=ys.learnus.org";
                        }
                        window.ReactNativeWebView.postMessage("COOKIES_CLEARED");
                        window.location.href = 'https://ys.learnus.org/passni/sso/spLogout.php';
                    })();
                `;
                webViewRef.current?.injectJavaScript(clearCookieScript);
                hasLoggedOut.current = true;

                setTimeout(() => {
                    setIsLoggingOut(false);
                    isLoggingOutRef.current = false;
                    if (onAutoLogoutComplete) onAutoLogoutComplete();
                }, 5000);
            }, 1000);
        }
    }, [autoLogout]);

    const handleNavigationStateChange = (navState: any) => {
        const { url } = navState;
        currentUrlRef.current = url;
        if (url.includes('/login/logout.php')) {
            hasLoggedOut.current = false;
            return;
        }
        const checkCookieScript = `if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(document.cookie);`;
        webViewRef.current?.injectJavaScript(checkCookieScript);

        const isDashboard =
            url === 'https://ys.learnus.org/' ||
            url === 'https://ys.learnus.org' ||
            url.includes('/my/');
        if (!isDashboard) hasLoggedOut.current = true;
    };

    const injectedJavaScript = `(function () { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(document.cookie); })(); true;`;

    const onMessage = async (event: any) => {
        const data = event.nativeEvent.data;
        if (data.startsWith('DEBUG') || isLoggingOutRef.current) return;
        if (data === 'COOKIES_CLEARED') return;

        const isLoginPage = currentUrlRef.current.includes('/login/');
        if (isLoginPage) return;

        const isAuthenticatedPage =
            currentUrlRef.current === 'https://ys.learnus.org/' ||
            currentUrlRef.current === 'https://ys.learnus.org' ||
            currentUrlRef.current.includes('/my/') ||
            currentUrlRef.current.includes('/course/') ||
            currentUrlRef.current.includes('/mod/');

        if (!isAuthenticatedPage) return;

        if (data && data.includes('MoodleSession') && !data.includes('MoodleSession=deleted')) {
            try {
                const result = await loginWithCookies(data);
                if (result.status === 'success' && result.api_token) {
                    const success = await onLoginSuccess(result.api_token);
                    if (!success) {
                        console.log('Login failed in App (invalid token?), clearing cookies to retry...');
                        const clearCookieScript = `
                        (function() {
                            var cookies = document.cookie.split(";");
                            for (var i = 0; i < cookies.length; i++) {
                                var cookie = cookies[i];
                                var eqPos = cookie.indexOf("=");
                                var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                                name = name.replace(/^ +/, "");
                                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.learnus.org";
                                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=ys.learnus.org";
                            }
                            window.location.reload();
                        })();
                        `;
                        webViewRef.current?.injectJavaScript(clearCookieScript);
                    }
                }
            } catch (e) {
                console.log('Session Sync Failed', e);
            }
        }
    };

    const handleReset = () => {
        if (!isLoggingOutRef.current) {
            setIsLoggingOut(true);
            isLoggingOutRef.current = true;
            webViewRef.current?.injectJavaScript(
                `window.location.href='https://ys.learnus.org/passni/sso/spLogout.php';`
            );
            setTimeout(() => {
                setIsLoggingOut(false);
                isLoggingOutRef.current = false;
            }, 5000);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

            {/* Header */}
            <Animated.View
                style={[
                    styles.header,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                <View style={styles.logoContainer}>
                    <LinearGradient
                        colors={[Colors.primary, Colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.logoGradient}
                    >
                        <Ionicons name="school" size={24} color={Colors.textInverse} />
                    </LinearGradient>
                    <View style={styles.logoText}>
                        <Text style={styles.logoTitle}>LearnUs Connect</Text>
                        <Text style={styles.logoSubtitle}>연세대학교 학습관리</Text>
                    </View>
                </View>
            </Animated.View>

            {/* WebView Container */}
            <View style={styles.webViewContainer}>
                {/* Controls */}
                <View style={styles.webViewControls}>
                    <View style={styles.urlBar}>
                        <Ionicons name="lock-closed" size={14} color={Colors.success} />
                        <Text style={styles.urlText} numberOfLines={1}>
                            ys.learnus.org
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.resetButton, isLoggingOut && styles.resetButtonDisabled]}
                        onPress={handleReset}
                        disabled={isLoggingOut}
                    >
                        <Ionicons
                            name="refresh"
                            size={18}
                            color={isLoggingOut ? Colors.textTertiary : Colors.textSecondary}
                        />
                        <Text style={[styles.resetButtonText, isLoggingOut && styles.resetButtonTextDisabled]}>
                            {isLoggingOut ? '처리 중...' : '초기화'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* WebView */}
                <View style={styles.webViewWrapper}>
                    <WebView
                        ref={webViewRef}
                        source={{ uri: url }}
                        cacheEnabled={false}
                        onNavigationStateChange={handleNavigationStateChange}
                        injectedJavaScript={injectedJavaScript}
                        onMessage={onMessage}
                        style={styles.webView}
                    />
                </View>
            </View>

            {/* Footer Hint */}
            <View style={styles.footer}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
                <Text style={styles.footerText}>
                    연세포털 계정으로 로그인하세요
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    // Header
    header: {
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        backgroundColor: Colors.background,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoGradient: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    logoText: {
        flex: 1,
    },
    logoTitle: {
        ...Typography.header2,
        fontSize: 20,
        color: Colors.textPrimary,
    },
    logoSubtitle: {
        ...Typography.caption,
        color: Colors.textSecondary,
        marginTop: 2,
    },

    // WebView Container
    webViewContainer: {
        flex: 1,
        marginHorizontal: Spacing.l,
        marginBottom: Spacing.m,
        borderRadius: Layout.borderRadius.xl,
        overflow: 'hidden',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.default,
    },
    webViewControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        backgroundColor: Colors.surfaceHighlight,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    urlBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingHorizontal: Spacing.s,
        paddingVertical: Spacing.xs,
        borderRadius: Layout.borderRadius.s,
        gap: 6,
    },
    urlText: {
        ...Typography.caption,
        color: Colors.textSecondary,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.xs,
        borderRadius: Layout.borderRadius.full,
        backgroundColor: Colors.surface,
        gap: 4,
    },
    resetButtonDisabled: {
        opacity: 0.6,
    },
    resetButtonText: {
        ...Typography.buttonSmall,
        color: Colors.textSecondary,
    },
    resetButtonTextDisabled: {
        color: Colors.textTertiary,
    },
    webViewWrapper: {
        flex: 1,
    },
    webView: {
        flex: 1,
        backgroundColor: Colors.surface,
    },

    // Footer
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.m,
        gap: 6,
    },
    footerText: {
        ...Typography.caption,
        color: Colors.textTertiary,
    },
});
