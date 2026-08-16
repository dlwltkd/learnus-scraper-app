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
import { filePageSource, getLibraryItem } from './services/api';
import type { LibraryItem, LibraryItemDetail } from './services/api';

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
    const { item, courseId, courseName } = route.params as { item: LibraryItem; courseId: number; courseName?: string };

    const [page, setPage] = useState(1);
    const [pageLoading, setPageLoading] = useState(true);
    const [detail, setDetail] = useState<LibraryItemDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(true);

    const isPdf = item.type === 'file' && item.kind === 'pdf' && !!item.pages;
    const pageCount = item.pages || 0;

    useEffect(() => {
        navigation.setOptions({ title: item.title?.slice(0, 28) || '자료' });
        let alive = true;
        (async () => {
            try {
                const d = await getLibraryItem(courseId, item.type, item.id);
                if (alive) setDetail(d);
            } catch (e) {
                console.log('Failed to load item detail', e);
            } finally {
                if (alive) setLoadingDetail(false);
            }
        })();
        return () => { alive = false; };
    }, [navigation, item.title, item.type, item.id, courseId]);

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
                                source={filePageSource(item.id, page)}
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

                {loadingDetail && (
                    <ActivityIndicator style={styles.detailLoading} color={colors.primary} />
                )}

                {/* Board: the posts themselves. A row that opened to nothing but its own
                    title was the whole problem — an announcement is its text. */}
                {detail?.posts && detail.posts.length > 0 && (
                    <View style={styles.posts}>
                        {detail.posts.map(post => (
                            <View key={post.id} style={styles.post}>
                                <Text style={styles.postTitle}>{post.title}</Text>
                                <Text style={styles.postMeta}>
                                    {[post.writer, post.date].filter(Boolean).join(' · ')}
                                </Text>
                                {!!post.content && <Text style={styles.postBody}>{post.content.trim()}</Text>}
                            </View>
                        ))}
                    </View>
                )}
                {detail?.type === 'board' && detail.posts?.length === 0 && (
                    <Text style={styles.emptyBody}>아직 글이 없어요.</Text>
                )}

                {/* Assignment instructions, lecture transcript, label text, extracted
                    slide text — all the same shape: readable body copy. */}
                {detail?.type === 'vod' && !!detail.summary && (
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>요약</Text>
                        <Text style={styles.body}>{detail.summary.trim()}</Text>
                    </View>
                )}

                {detail?.type !== 'board' && !!detail?.content && (
                    <View style={styles.bodyBlock}>
                        {detail.type === 'file' && <Text style={styles.bodyLabel}>추출된 텍스트</Text>}
                        {detail.type === 'vod' && <Text style={styles.bodyLabel}>강의 스크립트</Text>}
                        <Text style={styles.body} selectable>{detail.content.trim()}</Text>
                    </View>
                )}

                {!loadingDetail && detail && !detail.content && !detail.posts?.length && (
                    <Text style={styles.emptyBody}>
                        {detail.status === 'not_transcribed'
                            ? '아직 텍스트로 변환되지 않았어요.'
                            : '표시할 내용이 없어요.'}
                    </Text>
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

        detailLoading: { marginTop: Spacing.xl },

        posts: { marginTop: Spacing.l, gap: Spacing.m },
        post: {
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.m,
            borderWidth: 1,
            borderColor: colors.border,
            padding: Spacing.m,
            gap: 4,
        },
        postTitle: { ...typography.subtitle1 },
        postMeta: { ...typography.caption },
        postBody: { ...typography.body2, color: colors.textPrimary, lineHeight: 22, marginTop: 6 },

        summaryBox: {
            marginTop: Spacing.l,
            backgroundColor: colors.surfaceMuted,
            borderRadius: layout.borderRadius.m,
            padding: Spacing.m,
        },
        summaryLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 4 },

        bodyBlock: { marginTop: Spacing.l },
        bodyLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: Spacing.s },
        emptyBody: { ...typography.body2, color: colors.textTertiary, marginTop: Spacing.xl, textAlign: 'center' },

        body: { ...typography.body1, lineHeight: 24 },
        corpusNote: { ...typography.caption, marginTop: Spacing.l },
    });
