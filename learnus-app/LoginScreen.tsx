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
    Modal,
    TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CookieManager from '@react-native-cookies/cookies';
import * as Device from 'expo-device';

import { loginWithCookies } from './services/api';
import { DEMO_TOKEN, isDemoCredentials } from './services/demoMode';
import { Spacing, Animation } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import Button from './components/Button';

interface LoginScreenProps {
    onLoginSuccess: (token: string) => Promise<boolean>;
    autoLogout?: boolean;
    onAutoLogoutComplete?: () => void;
}

// LearnUs URL predicates. Kept together because these strings drift: the login form is
// served from /login.php (no trailing slash) while the app opens /login/index.php, and the
// logout chain never touches /login/ at all. Scattered url.includes() checks let those
// differences hide.
const isLoginUrl = (url: string) =>
    url.includes('/login/index.php') || url.includes('/login/') || url.includes('/login.php');

const isSSOCredentialsUrl = (url: string) => url.includes('infra.yonsei.ac.kr/sso');

// Entry point of a fresh SSO attempt — credentials have not been submitted yet.
const isSSOEntryUrl = (url: string) => url.includes('spLogin2.php');

// Observed logout chain: spLogout.php -> PmSLOService -> spLogoutProcess.php
const isLogoutUrl = (url: string) =>
    url.includes('/login/logout.php') ||
    url.includes('spLogout.php') ||
    url.includes('spLogoutProcess.php') ||
    url.includes('PmSLOService');

// How long the "로그인 중" overlay may stay up before we assume the flow is wedged.
const AUTH_OVERLAY_TIMEOUT_MS = 30000;

export default function LoginScreen({
    onLoginSuccess,
    autoLogout,
    onAutoLogoutComplete,
}: LoginScreenProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const isLoggingOutRef = useRef(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    // Manual demo login (Google Play review) — hidden behind a long-press on the logo.
    const [showDemoLogin, setShowDemoLogin] = useState(false);
    const [demoUsername, setDemoUsername] = useState('');
    const [demoPassword, setDemoPassword] = useState('');
    const [demoError, setDemoError] = useState<string | null>(null);

    const submitDemoLogin = async () => {
        if (!isDemoCredentials(demoUsername, demoPassword)) {
            setDemoError('아이디 또는 비밀번호가 올바르지 않아요.');
            return;
        }
        setDemoError(null);
        setShowDemoLogin(false);
        // Runs entirely on local mock data — no request is made.
        await onLoginSuccess(DEMO_TOKEN);
    };

    // WebView State
    const [url, setUrl] = useState('https://ys.learnus.org/login/index.php');
    const webViewRef = useRef<WebView>(null);
    const hasLoggedOut = useRef(false);
    const currentUrlRef = useRef('https://ys.learnus.org/login/index.php');
    const wasOnLoginPage = useRef(false);
    const pendingCookieString = useRef<string | null>(null);
    // Set once a logout is observed, cleared only when the user starts a new login attempt.
    // The logout chain lands on https://ys.learnus.org/, which is indistinguishable from a
    // successful login by URL alone — without this we can re-harvest cookies and undo the
    // logout as soon as the isLoggingOut timer lapses.
    const loggedOutAwaitingLogin = useRef(false);

    // Debug logging
    const debugLogsRef = useRef<Array<{timestamp: string; event: string; url?: string; data?: any}>>([]);
    const [showDebugLink, setShowDebugLink] = useState(false);
    const [showDebugModal, setShowDebugModal] = useState(false);
    const [debugSending, setDebugSending] = useState(false);
    const [debugSent, setDebugSent] = useState(false);

    const addDebugLog = (event: string, extra?: {url?: string; data?: any}) => {
        debugLogsRef.current.push({
            timestamp: new Date().toISOString(),
            event,
            ...extra,
        });
    };

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

    // Show debug link after 15 seconds stuck on loading
    useEffect(() => {
        if (isAuthenticating) {
            setShowDebugLink(false);
            setDebugSent(false);
            setAuthError(null);
            const timer = setTimeout(() => setShowDebugLink(true), 15000);
            // The overlay used to have no exit: if the WebView landed anywhere we don't
            // recognise (LearnUs' "already logged in" confirm page, an unreachable server),
            // it spun forever. Release it and tell the user what happened.
            const failTimer = setTimeout(() => {
                addDebugLog('auth_timeout', { url: currentUrlRef.current });
                setIsAuthenticating(false);
                wasOnLoginPage.current = false;
                setAuthError('로그인을 완료하지 못했어요. 아래 화면에서 다시 시도해 주세요.');
            }, AUTH_OVERLAY_TIMEOUT_MS);
            return () => {
                clearTimeout(timer);
                clearTimeout(failTimer);
            };
        } else {
            setShowDebugLink(false);
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
        addDebugLog('nav', { url });

        const isLoginPage = isLoginUrl(url);
        const isSSOCredentialsPage = isSSOCredentialsUrl(url);
        const isSSOEntryPage = isSSOEntryUrl(url);
        const isLogoutPage = isLogoutUrl(url);

        // Starting a new login attempt clears any stale flag from a previous session.
        if (isSSOEntryPage || isLogoutPage) {
            wasOnLoginPage.current = false;
        }
        if (isLogoutPage) {
            loggedOutAwaitingLogin.current = true;
        }
        // A deliberate new attempt (Portal/External Login) re-arms cookie capture.
        if (isSSOEntryPage || isSSOCredentialsPage) {
            loggedOutAwaitingLogin.current = false;
        }

        // Track if user is on SSO credentials page
        if (isSSOCredentialsPage) {
            wasOnLoginPage.current = true; // Mark that we're on SSO page
        }

        // Detect when user leaves SSO credentials page (clicked "log on")
        // They'll be redirected to learnus.org - show loading overlay
        if (wasOnLoginPage.current && !isSSOCredentialsPage && !isLoginPage && !isLoggingOutRef.current) {
            addDebugLog('overlay_on', { url });
            setIsAuthenticating(true);
        }

        // Reset tracking when back on login page
        if (isLoginPage) {
            wasOnLoginPage.current = false;
            setIsAuthenticating(false);
        }

        if (isLogoutPage) {
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
        addDebugLog('loadEnd', { url });
        // The logout chain ends on https://ys.learnus.org/, which is byte-identical to a
        // successful login landing. Only an explicit flag can tell them apart, and relying
        // on the isLoggingOut timer means a slow logout silently logs the user back in.
        if (isLogoutUrl(url) || loggedOutAwaitingLogin.current) {
            addDebugLog('loadEnd_skipped_after_logout', { url });
            return;
        }
        const isAuthenticatedPage =
            url === 'https://ys.learnus.org/' ||
            url === 'https://ys.learnus.org' ||
            url.startsWith('https://ys.learnus.org/?') ||
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
                const cookieKeys = Object.keys(allCookies).join(', ');
                console.log('CookieManager captured cookies:', cookieKeys);
                addDebugLog('cookieManager', { url, data: { cookieKeys } });
                if (cookieString.includes('MoodleSession')) {
                    // Inject script to get userId, then send cookies via onMessage
                    // Store cookie string for use in onMessage handler
                    pendingCookieString.current = cookieString;
                    webViewRef.current?.injectJavaScript(userIdCaptureScript);
                }
            } catch (e) {
                console.log('CookieManager error, falling back to document.cookie:', e);
                addDebugLog('cookieManager_error', { data: String(e) });
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

        addDebugLog('onMessage', { data: { messageLength: raw.length } });

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
                addDebugLog('parsedUserId', { data: { userId, hasCookies: !!data } });
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
            const cookieKeys = data
                .split(';')
                .map(item => item.trim().split('=', 1)[0])
                .filter(Boolean);
            addDebugLog('api_call', { url: '/auth/sync-session', data: { cookieKeys } });
            try {
                const result = await loginWithCookies(data, userId);
                addDebugLog('api_response', { data: { status: result.status, session_usable: result.session_usable, has_token: !!result.api_token } });
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
            } catch (e: any) {
                const status = e?.response?.status;
                console.log('Session sync failed', status ?? 'network_error');
                addDebugLog('api_error', { data: { status: status ?? null } });
                setIsAuthenticating(false);
                wasOnLoginPage.current = true;
                // A network failure here is indistinguishable from a rejected login unless
                // we say so — this is what made the dead-API-URL bug invisible.
                setAuthError(
                    e?.message === 'Network Error'
                        ? '서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.'
                        : '로그인 중 문제가 생겼어요. 다시 시도해 주세요.'
                );
            }
        }
    };

    const handleSendDebugReport = async () => {
        setDebugSending(true);
        try {
            console.log('Debug report (local only):', debugLogsRef.current.length, 'events');
            setDebugSent(true);
        } catch (e) {
            console.log('Failed to send debug report:', e);
        } finally {
            setDebugSending(false);
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
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

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
                {/* Long-pressing the logo opens the manual demo login used for store review */}
                <TouchableOpacity
                    style={styles.logoContainer}
                    activeOpacity={1}
                    delayLongPress={2000}
                    onLongPress={() => {
                        setDemoUsername('');
                        setDemoPassword('');
                        setDemoError(null);
                        setShowDemoLogin(true);
                    }}
                >
                    <View style={styles.logoGradient}>
                        <Ionicons name="school" size={24} color={colors.textInverse} />
                    </View>
                    <View style={styles.logoText}>
                        <Text style={styles.logoTitle}>LearnUs Connect</Text>
                        <Text style={styles.logoSubtitle}>연세대학교 학습관리</Text>
                    </View>
                </TouchableOpacity>
            </Animated.View>

            {/* WebView Container */}
            <View style={styles.webViewContainer}>
                {/* Controls */}
                <View style={styles.webViewControls}>
                    <View style={styles.urlBar}>
                        <Ionicons name="lock-closed" size={14} color={colors.success} />
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
                            color={isLoggingOut ? colors.textTertiary : colors.textSecondary}
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
                        allowFileAccess={false}
                        allowFileAccessFromFileURLs={false}
                        allowUniversalAccessFromFileURLs={false}
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
                                    <Ionicons name="school" size={32} color={colors.primary} />
                                </View>
                                <Text style={styles.loadingTitle}>로그인 중...</Text>
                                <Text style={styles.loadingSubtitle}>연세포털 인증을 처리하고 있습니다</Text>
                                <ActivityIndicator
                                    size="small"
                                    color={colors.primary}
                                    style={styles.loadingSpinner}
                                />
                                {showDebugLink && (
                                    <TouchableOpacity
                                        onPress={() => setShowDebugModal(true)}
                                        style={styles.debugLink}
                                    >
                                        <Text style={styles.debugLinkText}>로그인이 안 되나요?</Text>
                                    </TouchableOpacity>
                                )}
                            </Animated.View>
                        </Animated.View>
                    )}
                </View>
            </View>

            {/* Manual demo login for store review — no network, local mock data only */}
            <Modal
                visible={showDemoLogin}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDemoLogin(false)}
            >
                <View style={styles.debugModalBackdrop}>
                    <View style={styles.demoModalCard}>
                        <Text style={styles.demoModalTitle}>수동 로그인</Text>

                        <TextInput
                            style={styles.demoInput}
                            value={demoUsername}
                            onChangeText={setDemoUsername}
                            placeholder="아이디"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TextInput
                            style={styles.demoInput}
                            value={demoPassword}
                            onChangeText={setDemoPassword}
                            placeholder="비밀번호"
                            placeholderTextColor={colors.textTertiary}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                            onSubmitEditing={submitDemoLogin}
                        />

                        {demoError && <Text style={styles.demoErrorText}>{demoError}</Text>}

                        <TouchableOpacity style={styles.demoSubmitButton} onPress={submitDemoLogin}>
                            <Text style={styles.demoSubmitText}>로그인</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowDemoLogin(false)}>
                            <Text style={styles.demoCancelText}>취소</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Auth error — the overlay hides the WebView, so failures must be stated here */}
            {authError && (
                <View style={styles.authErrorBanner}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={styles.authErrorText}>{authError}</Text>
                    <TouchableOpacity onPress={() => setAuthError(null)} accessibilityLabel="닫기">
                        <Ionicons name="close" size={16} color={colors.error} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Footer Hint */}
            <View style={styles.footer}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
                <Text style={styles.footerText}>
                    연세포털 계정으로 로그인하세요
                </Text>
            </View>

            {/* Debug Report Modal */}
            <Modal
                visible={showDebugModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDebugModal(false)}
            >
                <View style={styles.debugModalBackdrop}>
                    <View style={styles.debugModalContent}>
                        <Text style={styles.debugModalTitle}>로그인 문제 진단</Text>
                        <Text style={styles.debugModalText}>
                            이 앱은 SSO 로그인 후 발급된 쿠키를 사용하여 러너스 데이터를 스크래핑합니다.{'\n\n'}
                            러너스에 로그인이 됐는데도 앱에 들어가지지 않는다면, 인증 처리에 문제가 발생한 것입니다.{'\n\n'}
                            아래 버튼을 누르면 디버그 정보가 개발자에게 전송됩니다.
                        </Text>
                        {debugSent ? (
                            <View style={styles.debugSentContainer}>
                                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                                <Text style={styles.debugSentText}>전송 완료! 감사합니다.</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.debugSendButton}
                                onPress={handleSendDebugReport}
                                disabled={debugSending}
                            >
                                {debugSending ? (
                                    <ActivityIndicator size="small" color={colors.textInverse} />
                                ) : (
                                    <Text style={styles.debugSendButtonText}>디버그 정보 전송</Text>
                                )}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.debugCloseButton}
                            onPress={() => setShowDebugModal(false)}
                        >
                            <Text style={styles.debugCloseButtonText}>닫기</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    // Header
    header: {
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        backgroundColor: colors.background,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoGradient: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.m,
    },
    logoText: {
        flex: 1,
    },
    logoTitle: {
        ...typography.header2,
        fontSize: 20,
        color: colors.textPrimary,
    },
    logoSubtitle: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },

    // WebView Container
    webViewContainer: {
        flex: 1,
        marginHorizontal: Spacing.l,
        marginBottom: Spacing.m,
        borderRadius: layout.borderRadius.xl,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        ...layout.shadow.default,
    },
    webViewControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        backgroundColor: colors.surfaceHighlight,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    urlBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: Spacing.s,
        paddingVertical: Spacing.xs,
        borderRadius: layout.borderRadius.s,
        gap: 6,
    },
    urlText: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.xs,
        borderRadius: layout.borderRadius.full,
        backgroundColor: colors.surface,
        gap: 4,
    },
    resetButtonDisabled: {
        opacity: 0.6,
    },
    resetButtonText: {
        ...typography.buttonSmall,
        color: colors.textSecondary,
    },
    resetButtonTextDisabled: {
        color: colors.textTertiary,
    },
    webViewWrapper: {
        flex: 1,
    },
    webView: {
        flex: 1,
        backgroundColor: colors.surface,
    },

    // Loading Overlay
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: isDark ? 'rgba(18, 20, 28, 0.95)' : 'rgba(248, 249, 252, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingCard: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.xl,
        padding: Spacing.xl,
        alignItems: 'center',
        ...layout.shadow.lg,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: 220,
    },
    loadingIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primaryLighter,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.m,
    },
    loadingTitle: {
        ...typography.subtitle1,
        color: colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    loadingSubtitle: {
        ...typography.caption,
        color: colors.textSecondary,
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
        ...typography.caption,
        color: colors.textTertiary,
    },
    authErrorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.s,
        backgroundColor: colors.errorLight,
        borderColor: colors.error,
        borderWidth: 1,
        borderRadius: layout.borderRadius.l,
        paddingVertical: Spacing.s,
        paddingHorizontal: Spacing.m,
        marginHorizontal: Spacing.m,
        marginBottom: Spacing.s,
    },
    authErrorText: {
        ...typography.caption,
        color: colors.error,
        flex: 1,
    },

    // Manual demo login (store review)
    demoModalCard: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.xl,
        padding: Spacing.xl,
        marginHorizontal: Spacing.l,
        // The backdrop centres its children, so without an explicit width the card
        // shrinks to its longest line of text.
        width: '100%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: colors.border,
        ...layout.shadow.lg,
    },
    demoModalTitle: {
        ...typography.header3,
        color: colors.textPrimary,
        marginBottom: Spacing.l,
    },
    demoInput: {
        ...typography.body2,
        color: colors.textPrimary,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: layout.borderRadius.m,
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        marginBottom: Spacing.s,
    },
    demoErrorText: {
        ...typography.caption,
        color: colors.error,
        marginBottom: Spacing.s,
    },
    demoSubmitButton: {
        backgroundColor: colors.primary,
        borderRadius: layout.borderRadius.m,
        paddingVertical: Spacing.m,
        alignItems: 'center',
        marginTop: Spacing.s,
    },
    demoSubmitText: {
        ...typography.button,
        color: colors.textInverse,
    },
    demoCancelText: {
        ...typography.caption,
        color: colors.textTertiary,
        textAlign: 'center',
        marginTop: Spacing.m,
    },

    // Debug
    debugLink: {
        marginTop: Spacing.m,
    },
    debugLinkText: {
        ...typography.caption,
        color: colors.textTertiary,
        textDecorationLine: 'underline',
    },
    debugModalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(26, 29, 38, 0.6)',
    },
    debugModalContent: {
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.xl,
        padding: Spacing.xl,
        marginHorizontal: Spacing.l,
        maxWidth: 340,
        width: '100%',
        ...layout.shadow.lg,
    },
    debugModalTitle: {
        ...typography.header3,
        textAlign: 'center',
        marginBottom: Spacing.m,
    },
    debugModalText: {
        ...typography.body2,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.l,
        lineHeight: 22,
    },
    debugSendButton: {
        backgroundColor: colors.primary,
        paddingVertical: Spacing.m,
        borderRadius: layout.borderRadius.m,
        alignItems: 'center',
        marginBottom: Spacing.s,
    },
    debugSendButtonText: {
        ...typography.button,
        color: colors.textInverse,
    },
    debugSentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: Spacing.s,
        paddingVertical: Spacing.m,
    },
    debugSentText: {
        ...typography.subtitle2,
        color: colors.success,
    },
    debugCloseButton: {
        paddingVertical: Spacing.s,
        alignItems: 'center',
    },
    debugCloseButtonText: {
        ...typography.buttonSmall,
        color: colors.textTertiary,
    },
});
