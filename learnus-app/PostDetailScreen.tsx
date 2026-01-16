import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions, StatusBar } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Colors } from './constants/theme';

export default function PostDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { post } = route.params as { post: any };
  const { width } = useWindowDimensions();

  useEffect(() => {
    navigation.setOptions({
      title: '게시물',
      headerStyle: { backgroundColor: Colors.surface },
      headerTintColor: Colors.textPrimary,
    });
  }, []);

  // Wrap content in basic HTML structure for WebView
  const htmlContent = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 20px;
            color: ${Colors.textPrimary};
            line-height: 1.6;
            background-color: ${Colors.background};
          }
          h2 { color: ${Colors.textPrimary}; margin-bottom: 8px; }
          .meta { color: ${Colors.textSecondary}; font-size: 0.9em; margin-bottom: 20px; }
          img { max-width: 100%; height: auto; border-radius: 8px; }
          a { color: ${Colors.primary}; text-decoration: none; }
          hr { border: 0; border-top: 1px solid ${Colors.border}; margin: 20px 0; }
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
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ flex: 1, width: width, backgroundColor: Colors.background }}
        textZoom={100}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
