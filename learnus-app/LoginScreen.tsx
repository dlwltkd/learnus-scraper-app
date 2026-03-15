import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    StatusBar,
    Platform,
    Animated,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CookieManager from '@react-native-cookies/cookies';

import { loginWithCookies } from './services/api';
import { Colors, Spacing, Layout, Typography, Animation } from './constants/theme';
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
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // WebView State
    const [url, setUrl] = useState('https://ys.learnus.org/login/index.php');
    const webViewRef = useRef<WebView>(null);
    const hasLoggedOut = useRef(false);
    const currentUrlRef = useRef('https://ys.learnus.org/login/index.php');
    const wasOnLoginPage = useRef(false);
    const pendingCookieString = useRef<string | null>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const loadingOpacity = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

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

    // Loading overlay animation
    useEffect(() => {
        if (isAuthenticating) {
            Animated.timing(loadingOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            // Pulse animation for the icon
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            Animated.timing(loadingOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isAuthenticating]);

    useEffect(() => {
        if (autoLogout) {
            console.log('Auto-logout triggered. Clearing cookies.');
            setIsLoggingOut(true);
            isLoggingOutRef.current = true;
            setTimeout(async () => {
                // Clear ALL cookies (including HttpOnly) via CookieManager
                try {
                    await CookieManager.clearAll();
                } catch (e) {
                    console.log('CookieManager clearAll error:', e);
                }
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

        const isLoginPage = url.includes('/login/index.php') || url.includes('/login/');
        const isSSOCredentialsPage = url.includes('infra.yonsei.ac.kr/sso');

        // Track if user is on SSO credentials page
        if (isSSOCredentialsPage) {
            wasOnLoginPage.current = true; // Mark that we're on SSO page
        }

        // Detect when user leaves SSO credentials page (clicked "log on")
        // They'll be redirected to learnus.org - show loading overlay
        if (wasOnLoginPage.current && !isSSOCredentialsPage && !isLoginPage && !isLoggingOutRef.current) {
            setIsAuthenticating(true);
        }

        // Reset tracking when back on login page
        if (isLoginPage) {
            wasOnLoginPage.current = false;
            setIsAuthenticating(false);
        }

        if (url.includes('/login/logout.php')) {
            hasLoggedOut.current = false;
            setIsAuthenticating(false);
            wasOnLoginPage.current = false;
            return;
        }

        const isDashboard =
            url === 'https://ys.learnus.org/' ||
            url === 'https://ys.learnus.org' ||
            url.includes('/my/');
        if (!isDashboard) hasLoggedOut.current = true;
    };

    // Script to extract userId from the authenticated page (Moodle exposes it in window.M.cfg)
    const userIdCaptureScript = `(function(){var uid=null;try{if(window.M&&window.M.cfg&&window.M.cfg.userid){uid=parseInt(window.M.cfg.userid)||null;}if(!uid){var m=(document.body.innerHTML||'').match(/"userid"\\s*:\\s*(\\d+)/);if(m)uid=parseInt(m[1]);}}catch(e){}if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'userId',userId:uid}));})();`;

    const handleLoadEnd = async (event: any) => {
        if (isLoggingOutRef.current) return;
        const url = event.nativeEvent.url || currentUrlRef.current;
        const isAuthenticatedPage =
            url === 'https://ys.learnus.org/' ||
            url === 'https://ys.learnus.org' ||
            url.includes('/my/') ||
            url.includes('/course/') ||
            url.includes('/mod/');
        if (isAuthenticatedPage) {
            // Use CookieManager to get ALL cookies (including HttpOnly) for the domain
            try {
                const allCookies = await CookieManager.get('https://ys.learnus.org');
                // Build a raw cookie string from ALL cookies (including HttpOnly ones)
                const cookieString = Object.entries(allCookies)
                    .map(([name, cookie]: [string, any]) => `${name}=${cookie.value}`)
                    .join('; ');
                console.log('CookieManager captured cookies:', Object.keys(allCookies).join(', '));
                if (cookieString.includes('MoodleSession')) {
                    // Inject script to get userId, then send cookies via onMessage
                    // Store cookie string for use in onMessage handler
                    pendingCookieString.current = cookieString;
                    webViewRef.current?.injectJavaScript(userIdCaptureScript);
                }
            } catch (e) {
                console.log('CookieManager error, falling back to document.cookie:', e);
                // Fallback: use document.cookie via injection
                const fallbackScript = `(function(){var uid=null;try{if(window.M&&window.M.cfg&&window.M.cfg.userid){uid=parseInt(window.M.cfg.userid)||null;}if(!uid){var m=(document.body.innerHTML||'').match(/"userid"\\s*:\\s*(\\d+)/);if(m)uid=parseInt(m[1]);}}catch(e){}if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'cookies',url:window.location.href,cookies:document.cookie,userId:uid}));})();`;
                webViewRef.current?.injectJavaScript(fallbackScript);
            }
        }
    };


    const onMessage = async (event: any) => {
        const raw = event.nativeEvent.data;
        if (isLoggingOutRef.current) return;
        if (raw === 'COOKIES_CLEARED') return;
        if (raw.startsWith('DEBUG')) return;

        // Parse structured message
        let data: string = '';
        let userId: number | null = null;
        try {
            const msg = JSON.parse(raw);
            if (msg.type === 'userId') {
                // CookieManager flow: cookies already captured, just need userId
                userId = msg.userId || null;
                data = pendingCookieString.current || '';
                pendingCookieString.current = null;
            } else if (msg.type === 'cookies') {
                // Fallback flow: cookies from document.cookie
                data = msg.cookies || '';
                userId = msg.userId || null;
            }
        } catch (_) {
            // legacy plain-text message
            data = raw;
        }

        if (data && data.includes('MoodleSession') && !data.includes('MoodleSession=deleted')) {
            try {
                const result = await loginWithCookies(data, userId);
                if (result.status === 'success' && result.api_token) {
                    if (result.session_usable === false) {
                        // Session is SSO-bound and not yet usable server-side.
                        // Log in anyway — data will sync on next re-login once the device token is set.
                        console.log('Session not yet usable server-side — user should re-login after first use.');
                    }
                    const success = await onLoginSuccess(result.api_token);
                    if (!success) {
                        console.log('Login failed in App (invalid token?), clearing cookies to retry...');
                        setIsAuthenticating(false);
                        wasOnLoginPage.current = true;
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
                    // Success case: loading will be hidden when screen unmounts
                }
            } catch (e) {
                console.log('Session Sync Failed', e);
                setIsAuthenticating(false);
                wasOnLoginPage.current = true;
            }
        }
    };

    const handleReset = () => {
        if (!isLoggingOutRef.current) {
            setIsLoggingOut(true);
            setIsAuthenticating(false);
            wasOnLoginPage.current = true;
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
                    <View style={styles.logoGradient}>
                        <Ionicons name="school" size={24} color={Colors.textInverse} />
                    </View>
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
                        onLoadEnd={handleLoadEnd}
                        onMessage={onMessage}
                        style={styles.webView}
                    />

                    {/* Loading Overlay */}
                    {isAuthenticating && (
                        <Animated.View
                            style={[
                                styles.loadingOverlay,
                                { opacity: loadingOpacity },
                            ]}
                            pointerEvents="auto"
                        >
                            <Animated.View
                                style={[
                                    styles.loadingCard,
                                    { transform: [{ scale: pulseAnim }] },
                                ]}
                            >
                                <View style={styles.loadingIconContainer}>
                                    <Ionicons name="school" size={32} color={Colors.primary} />
                                </View>
                                <Text style={styles.loadingTitle}>로그인 중...</Text>
                                <Text style={styles.loadingSubtitle}>연세포털 인증을 처리하고 있습니다</Text>
                                <ActivityIndicator
                                    size="small"
                                    color={Colors.primary}
                                    style={styles.loadingSpinner}
                                />
                            </Animated.View>
                        </Animated.View>
                    )}
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
        backgroundColor: Colors.primary,
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

    // Loading Overlay
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(248, 249, 252, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingCard: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.xl,
        padding: Spacing.xl,
        alignItems: 'center',
        ...Layout.shadow.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        minWidth: 220,
    },
    loadingIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primaryLighter,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.m,
    },
    loadingTitle: {
        ...Typography.subtitle1,
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    loadingSubtitle: {
        ...Typography.caption,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    loadingSpinner: {
        marginTop: Spacing.m,
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
