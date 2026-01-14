import React from 'react';
import { StyleSheet, View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

import CustomTabBar from './components/TabBar';
import { Colors, Layout, Typography } from './constants/theme';

import { AuthProvider, useAuth } from './context/AuthContext';

import { getDashboardOverview, registerPushToken } from './services/api';
import {
  registerForPushNotificationsAsync,
  registerBackgroundFetchAsync,
} from './services/NotificationService';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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

  React.useEffect(() => {
    if (isLoggedIn) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          registerPushToken(token)
            .then(() => console.log('Push Token Registered with Backend'))
            .catch(e => console.log('Failed to register token with backend:', e));
        }
      });
    }
  }, [isLoggedIn]);

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

  return (
    <NavigationContainer>
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
          headerBackTitleVisible: false,
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
              name="Help"
              component={HelpScreen}
              options={{
                title: '도움말',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ============================================
// ROOT APP
// ============================================
export default function App() {
  React.useEffect(() => {
    const setupNotifications = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        console.log('Token obtained inside App:', token);
      }
    };

    setupNotifications();
    registerBackgroundFetchAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
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
});
