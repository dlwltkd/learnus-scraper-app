import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { useTheme } from './context/ThemeContext';
import { getPostDetail } from './services/api';
import { Spacing } from './constants/theme';
import type { ColorScheme, LayoutType, TypographyType } from './constants/theme';


interface PostData {
    id?: number;
    title?: string;
    writer?: string;
    date?: string;
    content?: string;
    url?: string;
}


function htmlToPlainText(html: string): string {
    const withBreaks = html
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n');

    if (typeof DOMParser === 'undefined') {
        return withBreaks.replace(/<[^>]*>/g, '').trim();
    }

    const parsed = new DOMParser().parseFromString(withBreaks, 'text/html');
    parsed.querySelectorAll('script, style, noscript').forEach(node => node.remove());
    return (parsed.body.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}


export default function PostDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { post: initialPost, postId } = (route.params ?? {}) as {
        post?: PostData;
        postId?: number;
    };
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(
        () => createStyles(colors, typography, layout, isDark),
        [colors, typography, layout, isDark],
    );
    const [post, setPost] = useState<PostData>(initialPost || {});
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const shouldFetchPost = Boolean(
        postId && (!initialPost?.content || !initialPost?.writer || !initialPost?.date),
    );

    useEffect(() => {
        setPost(initialPost || {});
        setLoadError(null);
    }, [postId, initialPost?.url, initialPost?.title]);

    useEffect(() => {
        navigation.setOptions({ title: post.title || '게시물' });
    }, [navigation, post.title]);

    useEffect(() => {
        if (!shouldFetchPost || !postId) return;

        let active = true;
        setLoading(true);
        getPostDetail(postId)
            .then((fullPost: PostData) => {
                if (active) setPost(current => ({ ...current, ...fullPost }));
            })
            .catch(() => {
                if (active) setLoadError('게시물 내용을 불러오지 못했어요.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [postId, shouldFetchPost]);

    const content = post.content
        ? htmlToPlainText(post.content)
        : '내용이 없어요.';
    const meta = [post.writer, post.date].filter(Boolean).join(' · ');

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.article}>
                <Text style={styles.title}>{post.title || '게시물'}</Text>
                {meta && <Text style={styles.meta}>{meta}</Text>}
                <View style={styles.divider} />
                {loading ? (
                    <ActivityIndicator color={colors.primary} />
                ) : (
                    <Text style={[styles.content, loadError && styles.error]} selectable>
                        {loadError || content}
                    </Text>
                )}
            </View>
        </ScrollView>
    );
}


const createStyles = (
    colors: ColorScheme,
    typography: TypographyType,
    layout: LayoutType,
    _isDark: boolean,
) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        width: '100%',
        maxWidth: 880,
        alignSelf: 'center',
        padding: Spacing.screenPadding,
    },
    article: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: layout.borderRadius.xl,
        backgroundColor: colors.surface,
        padding: 28,
    },
    title: {
        ...typography.header2,
        color: colors.textPrimary,
    },
    meta: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 10,
    },
    divider: {
        height: 1,
        backgroundColor: colors.divider,
        marginVertical: 22,
    },
    content: {
        ...typography.body1,
        color: colors.textPrimary,
        lineHeight: 27,
    },
    error: {
        color: colors.error,
    },
});
