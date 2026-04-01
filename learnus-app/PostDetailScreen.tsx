import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, StatusBar } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { getPostDetail } from './services/api';

export default function PostDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { post: initialPost, postId } = (route.params ?? {}) as { post?: any; postId?: number };
  const { width } = useWindowDimensions();
  const { colors, typography, layout, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);
  const [post, setPost] = useState<any>(initialPost || {});
  const [loadError, setLoadError] = useState<string | null>(null);

  const shouldFetchPost = Boolean(postId && (!initialPost?.content || !initialPost?.writer || !initialPost?.date));

  useEffect(() => {
    setPost(initialPost || {});
    setLoadError(null);
  }, [postId, initialPost?.url, initialPost?.title]);

  useEffect(() => {
    navigation.setOptions({
      title: post?.title || '게시물',
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.textPrimary,
    });
  }, [navigation, post?.title, colors.surface, colors.textPrimary]);

  useEffect(() => {
    if (!shouldFetchPost || !postId) {
      setLoadError(null);
      return;
    }

    let isMounted = true;

    const loadPost = async () => {
      try {
        setLoadError(null);
        const fullPost = await getPostDetail(postId);
        if (isMounted) {
          setPost((currentPost: any) => ({
            ...currentPost,
            ...fullPost,
          }));
        }
      } catch (error) {
        if (isMounted) {
          setLoadError('게시물 내용을 불러오지 못했습니다.');
        }
      }
    };

    loadPost();

    return () => {
      isMounted = false;
    };
  }, [postId, shouldFetchPost]);

  const metaParts = [post?.writer, post?.date].filter(Boolean);
  const metaHtml = metaParts.length > 0
    ? `<div class="meta">${metaParts.join(' | ')}</div>`
    : '';
  const contentHtml = loadError
    ? `<p>${loadError}</p>`
    : (post?.content || '<p>내용이 없습니다.</p>');

  // Wrap content in basic HTML structure for WebView
  const htmlContent = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 20px;
            color: ${colors.textPrimary};
            line-height: 1.6;
            background-color: ${colors.background};
          }
          h2 { color: ${colors.textPrimary}; margin-bottom: 8px; }
          .meta { color: ${colors.textSecondary}; font-size: 0.9em; margin-bottom: 20px; }
          img { max-width: 100%; height: auto; border-radius: 8px; }
          a { color: ${colors.primary}; text-decoration: none; }
          hr { border: 0; border-top: 1px solid ${colors.border}; margin: 20px 0; }
          p { margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <h2>${post?.title || '게시물'}</h2>
        ${metaHtml}
        <hr />
        ${contentHtml}
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ flex: 1, width: width, backgroundColor: colors.background }}
        textZoom={100}
      />
    </View>
  );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
