import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { type ColorScheme, type TypographyType, type LayoutType } from '../constants/theme';

interface VodWebViewerProps {
    url: string;
    title: string;
    cookies: string;
    onClose: () => void;
    /** Seconds to start playback from, when opened from a cited moment. */
    startAt?: number;
}

const ALLOWED_VOD_HOSTS = new Set(['ys.learnus.org', 'commons.ys.learnus.org']);

export const isAllowedVodUrl = (value: string): boolean => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' && ALLOWED_VOD_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
};

export default function VodWebViewer({ url, title, cookies, onClose, startAt }: VodWebViewerProps) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
    const [loading, setLoading] = useState(true);
    const safeUrl = isAllowedVodUrl(url) ? url : 'about:blank';
    const requestHeaders = safeUrl === 'about:blank' ? undefined : { Cookie: cookies };

    const cookieScript = cookies
        ? cookies.split(';').map(c => c.trim()).filter(Boolean)
            .map(c => `document.cookie = ${JSON.stringify(c + '; domain=ys.learnus.org; path=/')};`)
            .join('\n') + '\ntrue;'
        : 'true;';

    // The player is video.js over HLS, so seeking means setting currentTime on the <video>
    // once it exists. It is created after page load and after the stream is attached, so
    // this polls briefly rather than firing once and missing.
    const seekScript = startAt && startAt > 0 ? `
(function () {
  var target = ${Math.floor(startAt)};
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var v = document.querySelector('video');
    if (v && !isNaN(v.duration) && v.duration > 0) {
      try { v.currentTime = Math.min(target, v.duration - 1); v.play(); } catch (e) {}
      clearInterval(timer);
    } else if (tries > 60) {
      clearInterval(timer);
    }
  }, 500);
})();
true;` : undefined;

    return (
        <Modal animationType="slide" statusBarTranslucent>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                        <Ionicons name="close" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                    <View style={{ width: 36 }} />
                </View>
                <WebView
                    source={{ uri: safeUrl, headers: requestHeaders }}
                    style={{ flex: 1 }}
                    injectedJavaScriptBeforeContentLoaded={cookieScript}
                    injectedJavaScript={seekScript}
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
                    originWhitelist={['https://ys.learnus.org', 'https://commons.ys.learnus.org']}
                    onShouldStartLoadWithRequest={(request) => {
                        return request.url === 'about:blank' || isAllowedVodUrl(request.url);
                    }}
                />
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                )}
            </SafeAreaView>
        </Modal>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.m,
        paddingVertical: Spacing.s,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        ...typography.subtitle1,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: Spacing.s,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
});
