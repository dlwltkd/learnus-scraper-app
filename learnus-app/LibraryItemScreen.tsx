import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { filePageUrl } from './services/api';
import type { LibraryItem } from './services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Viewer for one library artifact.
 *
 * PDFs render page by page through the same `render_page` cache that backs inline chat
 * citations — one mechanism serving browsing and citing, so a page fetched for either is
 * instant for the other.
 */
export default function LibraryItemScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(
        () => createStyles(colors, typography, layout, isDark),
        [colors, typography, layout, isDark],
    );
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { item, courseName } = route.params as { item: LibraryItem; courseName?: string };

    const [page, setPage] = useState(1);
    const [pageLoading, setPageLoading] = useState(true);

    const isPdf = item.type === 'file' && item.kind === 'pdf' && !!item.pages;
    const pageCount = item.pages || 0;

    useEffect(() => {
        navigation.setOptions({ title: item.title?.slice(0, 28) || '자료' });
    }, [navigation, item.title]);

    const goToPage = (next: number) => {
        if (next < 1 || next > pageCount) return;
        setPageLoading(true);
        setPage(next);
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>
                    {courseName ? `${courseName} · ` : ''}
                    {item.type === 'file' && item.pages ? `${item.pages}쪽` : ''}
                    {item.type === 'vod' && item.duration ? `${Math.round(item.duration / 60)}분` : ''}
                    {item.type === 'assignment' && item.due_date ? String(item.due_date).slice(0, 20) : ''}
                    {item.type === 'board' && item.posts ? `글 ${item.posts}개` : ''}
                </Text>

                {/* Say plainly when the brain cannot answer from this yet, rather than
                    letting the student assume it can. */}
                {!item.in_corpus && (
                    <View style={styles.notice}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.noticeText}>
                            {item.type === 'vod'
                                ? '아직 텍스트로 변환되지 않아 브레인이 참고할 수 없어요.'
                                : '아직 학습되지 않아 브레인이 참고할 수 없어요.'}
                        </Text>
                    </View>
                )}

                {isPdf && (
                    <View style={styles.viewer}>
                        <View style={styles.pageFrame}>
                            {pageLoading && (
                                <View style={styles.pageLoading}>
                                    <ActivityIndicator color={colors.primary} />
                                </View>
                            )}
                            <Image
                                source={{ uri: filePageUrl(item.id, page) }}
                                style={styles.pageImage}
                                resizeMode="contain"
                                onLoadEnd={() => setPageLoading(false)}
                            />
                        </View>

                        <View style={styles.pager}>
                            <TouchableOpacity
                                onPress={() => goToPage(page - 1)}
                                disabled={page <= 1}
                                style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
                                activeOpacity={0.6}
                            >
                                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                            </TouchableOpacity>
                            <Text style={styles.pagerText}>{page} / {pageCount}</Text>
                            <TouchableOpacity
                                onPress={() => goToPage(page + 1)}
                                disabled={page >= pageCount}
                                style={[styles.pagerBtn, page >= pageCount && styles.pagerBtnDisabled]}
                                activeOpacity={0.6}
                            >
                                <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {item.type === 'label' && (
                    <Text style={styles.body}>{item.title}</Text>
                )}

                {item.chars > 0 && (
                    <Text style={styles.corpusNote}>
                        브레인이 학습한 텍스트 {item.chars.toLocaleString()}자
                        {item.captioned_pages ? ` · 이미지 설명 ${item.captioned_pages}개` : ''}
                    </Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: Spacing.l, paddingBottom: Spacing.xxl },

        title: { ...typography.header3 },
        meta: { ...typography.caption, marginTop: 4 },

        notice: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.s,
            backgroundColor: colors.surfaceMuted,
            borderRadius: layout.borderRadius.m,
            padding: Spacing.m,
            marginTop: Spacing.m,
        },
        noticeText: { ...typography.caption, color: colors.textSecondary, flex: 1 },

        viewer: { marginTop: Spacing.l },
        pageFrame: {
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.m,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            minHeight: 220,
            justifyContent: 'center',
        },
        pageImage: { width: '100%', height: (SCREEN_WIDTH - Spacing.l * 2) * 0.75 },
        pageLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 1 },

        pager: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.l,
            marginTop: Spacing.m,
        },
        pagerBtn: {
            width: 40, height: 40, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1, borderColor: colors.border,
        },
        pagerBtnDisabled: { opacity: 0.35 },
        pagerText: { ...typography.subtitle2, fontVariant: ['tabular-nums'] },

        body: { ...typography.body1, marginTop: Spacing.l, lineHeight: 24 },
        corpusNote: { ...typography.caption, marginTop: Spacing.l },
    });
