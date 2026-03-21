import React from 'react';
import { StyleSheet, View, ActivityIndicator, StatusBar, Alert, AppState, Text, Linking, TouchableOpacity } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';


import LoginScreen from './LoginScreen';
import DashboardScreen from './DashboardScreen';
import CoursesScreen from './CoursesScreen';
import SettingsScreen from './SettingsScreen';
import CourseDetailScreen from './CourseDetailScreen';
import BoardScreen from './BoardScreen';
import VideoLecturesScreen from './VideoLecturesScreen';
import PostDetailScreen from './PostDetailScreen';
import ManageCoursesScreen from './ManageCoursesScreen';
import HelpScreen from './HelpScreen';
import NotificationSettingsScreen from './NotificationSettingsScreen';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import MyInfoScreen from './MyInfoScreen';
import TermsOfServiceScreen from './TermsOfServiceScreen';
import NotificationHistoryScreen from './NotificationHistoryScreen';
import VodTranscriptScreen from './VodTranscriptScreen';

import CustomTabBar from './components/TabBar';
import { Colors, Layout, Typography } from './constants/theme';

import { AuthProvider, useAuth } from './context/AuthContext';
import { UserProvider } from './context/UserContext';
import { ToastProvider } from './context/ToastContext';
import { TourProvider, TourProviderHandle, hasTourCompleted } from './context/TourContext';
import TourOverlay from './components/TourOverlay';
import NotificationOnboarding from './components/NotificationOnboarding';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDashboardOverview, registerPushToken, checkAppVersion } from './services/api';
import { APP_VERSION } from './constants/version';

const NOTIF_PROMPT_DISMISSED_KEY = 'notif_prompt_dismissed_at';
import {
  registerForPushNotificationsAsync,
  registerBackgroundFetchAsync,
  setupNotificationReceivedListener,
  saveNotificationResponseToHistory,
} from './services/NotificationService';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<any>();

function handleNotificationTap(data: any) {
  if (!navigationRef.isReady() || !data) return;
  if (data.type === 'announcement' && data.postUrl) {
    navigationRef.navigate('PostDetail', {
      post: {
        url: data.postUrl,
        title: data.postTitle || '공지사항',
      },
    });
  } else if (data.type === 'transcription_complete' && data.vodMoodleId) {
    navigationRef.navigate('VodTranscript', {
      vodMoodleId: data.vodMoodleId,
      title: data.vodTitle || '강의 텍스트',
      courseName: data.courseName || '',
    });
  }
}

// ============================================
// TAB NAVIGATOR WITH CUSTOM TAB BAR
// ============================================
function TabNavigator() {
  const [badges, setBadges] = React.useState<Record<string, number>>({});

  const fetchBadge = async () => {
    try {
      const data = await getDashboardOverview();
      if (data?.available_vods) {
        const count = data.available_vods.filter((v: any) => !v.is_completed).length;
        setBadges(prev => ({
          ...prev,
          VideoLectures: count > 0 ? count : 0,
        }));
      }
    } catch (e) {
      console.log('Badge fetch failed', e);
    }
  };

  React.useEffect(() => {
    fetchBadge();
    const interval = setInterval(fetchBadge, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} badges={badges} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="VideoLectures" component={VideoLecturesScreen} />
      <Tab.Screen name="Courses" component={CoursesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// ============================================
// APP CONTENT
// ============================================
function AppContent() {
  const { isLoggedIn, login, autoLogout, resetAutoLogout, isLoading } = useAuth();
  const tourRef = React.useRef<TourProviderHandle>(null);
  const [showNotifOnboarding, setShowNotifOnboarding] = React.useState(false);

  const startTourAfterOnboarding = React.useCallback(() => {
    setTimeout(() => tourRef.current?.startTour(), 800);
  }, []);

  const isFirstTimeRef = React.useRef(false);

  const handleNotifEnable = React.useCallback(() => {
    setShowNotifOnboarding(false);
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        registerPushToken(token)
          .then(() => console.log('Push Token Registered with Backend'))
          .catch(e => console.log('Failed to register token with backend:', e));
      }
    });
    if (isFirstTimeRef.current) {
      startTourAfterOnboarding();
    }
  }, [startTourAfterOnboarding]);

  const handleNotifSkip = React.useCallback(() => {
    setShowNotifOnboarding(false);
    // Remember dismissal for 7 days so we don't nag every app open
    AsyncStorage.setItem(NOTIF_PROMPT_DISMISSED_KEY, Date.now().toString());
    // Still request permission via OS dialog
    registerForPushNotificationsAsync().then(token => {
      if (token) registerPushToken(token).catch(() => {});
    });
    if (isFirstTimeRef.current) {
      startTourAfterOnboarding();
    }
  }, [startTourAfterOnboarding]);

  React.useEffect(() => {
    if (!isLoggedIn) return;

    const init = async () => {
      const tourCompleted = await hasTourCompleted();
      const { status } = await Notifications.getPermissionsAsync();
      const hasNotifPermission = status === 'granted';

      if (!tourCompleted) {
        // First-time user: always show notif onboarding, then tour
        isFirstTimeRef.current = true;
        if (!hasNotifPermission) {
          setTimeout(() => setShowNotifOnboarding(true), 1000);
        } else {
          // Already has permission (e.g. granted at OS level), skip to tour
          registerForPushNotificationsAsync().then(token => {
            if (token) registerPushToken(token).catch(() => {});
          });
          setTimeout(() => tourRef.current?.startTour(), 1500);
        }
      } else {
        // Returning user
        isFirstTimeRef.current = false;
        if (hasNotifPermission) {
          // Already granted — register silently
          registerForPushNotificationsAsync().then(token => {
            if (token) registerPushToken(token).catch(() => {});
          });
        } else {
          // Not granted — show prompt if they haven't dismissed recently (7 days)
          const dismissedAt = await AsyncStorage.getItem(NOTIF_PROMPT_DISMISSED_KEY);
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          const shouldPrompt = !dismissedAt || (Date.now() - parseInt(dismissedAt, 10)) > sevenDays;
          if (shouldPrompt) {
            setTimeout(() => setShowNotifOnboarding(true), 1500);
          }
        }
      }
    };

    init();
  }, [isLoggedIn]);

  const [forceUpdate, setForceUpdate] = React.useState<string | null>(null);

  React.useEffect(() => {
    checkAppVersion().then(({ version: latestVersion, forceUpdateMin }) => {
      if (!latestVersion || latestVersion === APP_VERSION) return;

      if (forceUpdateMin && APP_VERSION < forceUpdateMin) {
        // App is below the minimum required version — block usage
        setForceUpdate(latestVersion);
      } else {
        // Optional update — prompt with link to Play Store
        Alert.alert(
          '업데이트 안내',
          `새로운 버전(${latestVersion})이 있습니다.\n앱을 업데이트해 주세요.`,
          [
            { text: '나중에', style: 'cancel' },
            { text: '업데이트', onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.jisang.learnusconnect') },
          ]
        );
      }
    });
  }, []);

  const handleLoginSuccess = async (cookie: string): Promise<boolean> => {
    try {
      await login(cookie);
      return true;
    } catch (e: any) {
      console.log('Login failed (initial sync):', e.message);
      return false;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (forceUpdate) {
    return (
      <View style={styles.forceUpdateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <Text style={styles.forceUpdateTitle}>업데이트 필요</Text>
        <Text style={styles.forceUpdateMessage}>
          새로운 버전({forceUpdate})이 출시되었습니다.{'\n'}
          현재 버전({APP_VERSION})은 더 이상 사용할 수 없습니다.{'\n'}
          앱을 업데이트해 주세요.
        </Text>
        <TouchableOpacity
          style={styles.forceUpdateButton}
          onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.jisang.learnusconnect')}
          activeOpacity={0.7}
        >
          <Text style={styles.forceUpdateButtonText}>업데이트</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <TourProvider navigationRef={navigationRef} ref={tourRef}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: Colors.background,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
            headerTintColor: Colors.textPrimary,
            headerTitleStyle: {
              ...Typography.subtitle1,
              fontSize: 17,
            },
            cardStyle: {
              backgroundColor: Colors.background,
            },
          }}
        >
          {!isLoggedIn ? (
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {props => (
                <LoginScreen
                  {...props}
                  onLoginSuccess={handleLoginSuccess}
                  autoLogout={autoLogout}
                  onAutoLogoutComplete={resetAutoLogout}
                />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen
                name="Main"
                component={TabNavigator}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="CourseDetail"
                component={CourseDetailScreen}
                options={{
                  title: '',
                  headerBackTitle: '뒤로',
                }}
              />
              <Stack.Screen
                name="Board"
                component={BoardScreen}
                options={{
                  title: '게시판',
                }}
              />
              <Stack.Screen
                name="PostDetail"
                component={PostDetailScreen}
                options={{
                  title: '게시물',
                }}
              />
              <Stack.Screen
                name="ManageCourses"
                component={ManageCoursesScreen}
                options={{
                  title: '강의 관리',
                }}
              />
              <Stack.Screen
                name="NotificationSettings"
                component={NotificationSettingsScreen}
                options={{
                  title: '알림 설정',
                }}
              />
              <Stack.Screen
                name="MyInfo"
                component={MyInfoScreen}
                options={{
                  title: '내 정보',
                }}
              />
              <Stack.Screen
                name="Help"
                component={HelpScreen}
                options={{
                  title: '도움말',
                }}
              />
              <Stack.Screen
                name="PrivacyPolicy"
                component={PrivacyPolicyScreen}
                options={{
                  title: '개인정보 처리방침',
                }}
              />
              <Stack.Screen
                name="TermsOfService"
                component={TermsOfServiceScreen}
                options={{
                  title: '이용약관',
                }}
              />
              <Stack.Screen
                name="NotificationHistory"
                component={NotificationHistoryScreen}
                options={{
                  title: '알림 기록',
                }}
              />
              <Stack.Screen
                name="VodTranscript"
                component={VodTranscriptScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
        </Stack.Navigator>
        <TourOverlay />
        {showNotifOnboarding && (
          <NotificationOnboarding
            onEnable={handleNotifEnable}
            onSkip={handleNotifSkip}
          />
        )}
      </TourProvider>
    </NavigationContainer>
  );
}

// ============================================
// ROOT APP
// ============================================
export default function App() {
  React.useEffect(() => {
    // Note: push notification registration is handled in AppContent
    // after the onboarding prompt, so we don't request permission here.
    registerBackgroundFetchAsync();

    // Save any delivered notifications that arrived while app was in background
    const saveDeliveredNotifications = async () => {
      const delivered = await Notifications.getPresentedNotificationsAsync();
      for (const n of delivered) {
        const { title, body, data } = n.request.content;
        if (data?.saveToHistory && title && body) {
          await saveNotificationResponseToHistory({
            request: n.request,
          } as any);
        }
      }
      if (delivered.length > 0) {
        await Notifications.dismissAllNotificationsAsync();
      }
    };
    saveDeliveredNotifications();

    // Also save when app comes back from background
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        saveDeliveredNotifications();
      }
    });

    // Save received notifications to history
    const notificationListener = setupNotificationReceivedListener();

    // Handle notification taps — navigate to the right screen and save to history
    // (covers background/killed state where addNotificationReceivedListener doesn't fire)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      saveNotificationResponseToHistory(response.notification);
      const data = response.notification.request.content.data;
      handleNotificationTap(data);
    });

    // Handle tap when app was closed (cold start)
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        saveNotificationResponseToHistory(response.notification);
        handleNotificationTap(response.notification.request.content.data);
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
      appStateListener.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthProvider>
            <UserProvider>
              <AppContent />
            </UserProvider>
          </AuthProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forceUpdateContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  forceUpdateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  forceUpdateMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  forceUpdateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  forceUpdateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
