import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { loginWithCookies } from './services/api';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import Button from './components/Button';
import { Ionicons } from '@expo/vector-icons';

interface LoginScreenProps {
    onLoginSuccess: (token: string) => void;
    autoLogout?: boolean;
    onAutoLogoutComplete?: () => void;
}

export default function LoginScreen({ onLoginSuccess, autoLogout, onAutoLogoutComplete }: LoginScreenProps) {
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
                <View style={styles.logoRow}>
                    <Ionicons name="school" size={24} color={Colors.primary} />
                    <Text style={styles.logoText}>LearnUs Connect</Text>
                </View>
            </View>
            <View style={{ flex: 1 }}>
                <View style={styles.webViewControls}>
                    <Button title={isLoggingOut ? "Logging out..." : "Reset"} onPress={() => { if (!isLoggingOutRef.current) { setIsLoggingOut(true); isLoggingOutRef.current = true; webViewRef.current?.injectJavaScript(`window.location.href='https://ys.learnus.org/passni/sso/spLogout.php';`); setTimeout(() => { setIsLoggingOut(false); isLoggingOutRef.current = false; }, 5000); } }} variant="ghost" style={{ paddingVertical: 8 }} disabled={isLoggingOut} />
                </View>
                <WebView ref={webViewRef} source={{ uri: url }} cacheEnabled={false} onNavigationStateChange={handleNavigationStateChange} injectedJavaScript={injectedJavaScript} onMessage={onMessage} style={{ flex: 1 }} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: { padding: Spacing.m, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
    webViewControls: { flexDirection: 'row', justifyContent: 'flex-end', padding: Spacing.s, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
});
