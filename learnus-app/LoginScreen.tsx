import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, Switch, StatusBar, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { loginWithCredentials, loginWithCookies } from './services/api';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import Button from './components/Button';
import { Ionicons } from '@expo/vector-icons';

interface LoginScreenProps {
    onLoginSuccess: (token: string) => void;
    autoLogout?: boolean;
    onAutoLogoutComplete?: () => void;
}

export default function LoginScreen({ onLoginSuccess, autoLogout, onAutoLogoutComplete }: LoginScreenProps) {
    const [useWebView, setUseWebView] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const isLoggingOutRef = useRef(false);

    // WebView State
    const [url, setUrl] = useState('https://ys.learnus.org/login/index.php');
    const webViewRef = useRef<WebView>(null);
    const hasLoggedOut = useRef(false);
    const currentUrlRef = useRef('https://ys.learnus.org/login/index.php');

    React.useEffect(() => {
        if (autoLogout) {
            console.log("Auto-logout triggered. Clearing cookies.");
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

    const handleNativeLogin = async () => {
        setLoading(true);
        try {
            const result = await loginWithCredentials(username, password);
            if (result.status === 'success' && result.api_token) {
                onLoginSuccess(result.api_token);
            } else {
                alert("Login Failed: " + (result.message || result.detail || "Unknown Error"));
            }
        } catch (e: any) {
            alert("Login Error: " + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    };

    const handleNavigationStateChange = (navState: any) => {
        const { url } = navState;
        currentUrlRef.current = url;
        if (url.includes('/login/logout.php')) {
            hasLoggedOut.current = false; return;
        }
        const checkCookieScript = `if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(document.cookie);`;
        webViewRef.current?.injectJavaScript(checkCookieScript);

        const isDashboard = url === 'https://ys.learnus.org/' || url === 'https://ys.learnus.org' || url.includes('/my/');
        if (!isDashboard) hasLoggedOut.current = true;
    };

    const injectedJavaScript = `(function () { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(document.cookie); })(); true;`;

    const onMessage = async (event: any) => {
        const data = event.nativeEvent.data;
        if (data.startsWith("DEBUG") || isLoggingOutRef.current) return;
        if (data === "COOKIES_CLEARED") return;

        const isLoginPage = currentUrlRef.current.includes('/login/');
        if (isLoginPage) return;

        if (data && data.includes('MoodleSession') && !data.includes('MoodleSession=deleted')) {
            // Found a session cookie, exchange for API Token
            try {
                // Prevent multiple calls
                if (loading) return;

                const result = await loginWithCookies(data);
                if (result.status === 'success' && result.api_token) {
                    onLoginSuccess(result.api_token);
                }
            } catch (e) {
                console.log("Session Sync Failed", e);
            }
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <View style={styles.header}>
                <View style={styles.toggleContainer}>
                    <Text style={styles.toggleLabel}>{useWebView ? "Web Login" : "ID/PW Login"}</Text>
                    <Switch value={useWebView} onValueChange={setUseWebView} trackColor={{ false: Colors.textTertiary, true: Colors.primary }} thumbColor={Colors.surface} />
                </View>
            </View>
            {useWebView ? (
                <View style={{ flex: 1 }}>
                    <View style={styles.webViewControls}>
                        <Button title={isLoggingOut ? "Logging out..." : "Reset"} onPress={() => { if (!isLoggingOutRef.current) { setIsLoggingOut(true); isLoggingOutRef.current = true; webViewRef.current?.injectJavaScript(`window.location.href='https://ys.learnus.org/passni/sso/spLogout.php';`); setTimeout(() => { setIsLoggingOut(false); isLoggingOutRef.current = false; }, 5000); } }} variant="ghost" style={{ paddingVertical: 8 }} disabled={isLoggingOut} />
                    </View>
                    <WebView ref={webViewRef} source={{ uri: url }} cacheEnabled={false} onNavigationStateChange={handleNavigationStateChange} injectedJavaScript={injectedJavaScript} onMessage={onMessage} style={{ flex: 1 }} />
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.formContainer}>
                    <View style={styles.logoContainer}><View style={styles.logoCircle}><Ionicons name="school" size={48} color={Colors.primary} /></View><Text style={styles.title}>LearnUs Connect</Text><Text style={styles.subtitle}>Yonsei University</Text></View>
                    <View style={styles.inputContainer}><Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} /><TextInput style={styles.input} placeholder="Username" placeholderTextColor={Colors.textTertiary} value={username} onChangeText={setUsername} autoCapitalize="none" /></View>
                    <View style={styles.inputContainer}><Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} /><TextInput style={styles.input} placeholder="Password" placeholderTextColor={Colors.textTertiary} value={password} onChangeText={setPassword} secureTextEntry /></View>
                    <Button title="Log In" onPress={handleNativeLogin} loading={loading} style={{ marginTop: Spacing.l, width: '100%' }} variant="primary" />
                    <Text style={styles.hint}>Use this if web login is unavailable.</Text>
                </KeyboardAvoidingView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: { padding: Spacing.m, backgroundColor: Colors.background, alignItems: 'flex-end' },
    toggleContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: Spacing.m, paddingVertical: Spacing.xs, borderRadius: 20, ...Layout.shadow.default },
    toggleLabel: { marginRight: Spacing.s, ...Typography.caption, fontWeight: '600' },
    webViewControls: { flexDirection: 'row', justifyContent: 'flex-end', padding: Spacing.s, backgroundColor: Colors.background },
    formContainer: { flex: 1, padding: Spacing.xl, justifyContent: 'center', alignItems: 'center' },
    logoContainer: { alignItems: 'center', marginBottom: Spacing.xxl },
    logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E8F3FF', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.m },
    title: { ...Typography.header1, color: Colors.primary, marginBottom: 4 },
    subtitle: { ...Typography.body2, color: Colors.textSecondary },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Layout.borderRadius.m, marginBottom: Spacing.m, paddingHorizontal: Spacing.m, width: '100%', height: 56, ...Layout.shadow.default },
    inputIcon: { marginRight: Spacing.m },
    input: { flex: 1, fontSize: 16, color: Colors.textPrimary },
    hint: { marginTop: Spacing.l, ...Typography.caption, textAlign: 'center' },
});
