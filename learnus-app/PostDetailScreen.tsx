import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, StatusBar } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';

export default function PostDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { post } = route.params as { post: any };
  const { width } = useWindowDimensions();
  const { colors, typography, layout, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

  useEffect(() => {
    navigation.setOptions({
      title: '게시물',
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.textPrimary,
    });
  }, [navigation, colors.surface, colors.textPrimary]);

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
        <h2>${post.title}</h2>
        <div class="meta">By ${post.writer} | ${post.date}</div>
        <hr />
        ${post.content || '<p>내용이 없습니다.</p>'}
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
