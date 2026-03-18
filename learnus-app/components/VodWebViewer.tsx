import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Colors, Spacing, Typography } from '../constants/theme';

interface VodWebViewerProps {
    url: string;
    title: string;
    cookies: string;
    onClose: () => void;
}

export default function VodWebViewer({ url, title, cookies, onClose }: VodWebViewerProps) {
    const [loading, setLoading] = useState(true);

    const cookieScript = cookies
        ? cookies.split(';').map(c => c.trim()).filter(Boolean)
            .map(c => `document.cookie = ${JSON.stringify(c + '; domain=ys.learnus.org; path=/')};`)
            .join('\n') + '\ntrue;'
        : 'true;';

    return (
        <Modal animationType="slide" statusBarTranslucent>
            <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                        <Ionicons name="close" size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                    <View style={{ width: 36 }} />
                </View>
                <WebView
                    source={{ uri: url, headers: { Cookie: cookies } }}
                    style={{ flex: 1 }}
                    injectedJavaScriptBeforeContentLoaded={cookieScript}
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    allowsInlineMediaPlayback
                    allowsFullscreenVideo
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled
                    sharedCookiesEnabled
                    thirdPartyCookiesEnabled
                    allowFileAccess={false}
                    allowFileAccessFromFileURLs={false}
                    allowUniversalAccessFromFileURLs={false}
                    originWhitelist={['https://ys.learnus.org', 'https://*']}
                    onShouldStartLoadWithRequest={(request) => {
                        return request.url.startsWith('https://ys.learnus.org') ||
                               request.url.startsWith('https://commons.ys.learnus.org') ||
                               request.url.startsWith('about:blank');
                    }}
                />
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                )}
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        ...Typography.subtitle1,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: Spacing.s,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
});
