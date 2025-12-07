import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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

import { Colors } from './constants/theme';


import { AuthProvider, useAuth } from './context/AuthContext';

import { getDashboardOverview, registerPushToken } from './services/api';
import { registerForPushNotificationsAsync, registerBackgroundFetchAsync, unregisterBackgroundFetchAsync } from './services/NotificationService';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const [vodBadge, setVodBadge] = React.useState<number | undefined>(undefined);

  const fetchBadge = async () => {
    try {
      const data = await getDashboardOverview();
      if (data?.available_vods) {
        const count = data.available_vods.filter((v: any) => !v.is_completed).length;
        setVodBadge(count > 0 ? count : undefined);
      }
    } catch (e) {
      console.log("Badge fetch failed", e);
    }
  };

  React.useEffect(() => {
    fetchBadge();
    const interval = setInterval(fetchBadge, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Courses') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={24} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          height: 60 + insets.bottom, // Reduced by 5px to remove top space
          paddingBottom: 10 + insets.bottom, // Base padding + safe area inset
          paddingTop: 5, // Reduced top padding
          borderTopColor: Colors.border,
          backgroundColor: Colors.surface,
          elevation: 0, // Flat design
          borderTopWidth: 1,
          shadowOpacity: 0, // Remove shadow for flat design
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 5,
        },
      })
      }
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: '홈',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="VideoLectures"
        component={VideoLecturesScreen}
        options={{
          tabBarLabel: '동강',
          tabBarBadge: vodBadge,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Courses"
        component={CoursesScreen}
        options={{ tabBarLabel: '강의' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: '설정' }}
      />
    </ Tab.Navigator>
  );
}

function AppContent() {
  const { isLoggedIn, login, autoLogout, resetAutoLogout, isLoading } = useAuth();

  // Sync Push Token whenever user logs in or app mounts and is logged in
  React.useEffect(() => {
    if (isLoggedIn) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          registerPushToken(token).then(() => console.log("Push Token Registered with Backend"))
            .catch(e => console.log("Failed to register token with backend:", e));
        }
      });
    }
  }, [isLoggedIn]);

  const handleLoginSuccess = async (cookie: string): Promise<boolean> => {

    try {
      await login(cookie);
      return true;
    } catch (e: any) {
      console.log("Login failed (initial sync):", e.message);
      return false;
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.background, // Match background for seamless look
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0, // Remove border for cleaner look
          },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '700',
            color: Colors.textPrimary,
            fontSize: 18,
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
            <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
            <Stack.Screen name="Board" component={BoardScreen} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} />
            <Stack.Screen name="ManageCourses" component={ManageCoursesScreen} options={{ title: '강의 관리' }} />
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
              options={{ title: '도움말' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer >
  );
}

export default function App() {
  React.useEffect(() => {
    // Separate function to handle async token registration
    const setupNotifications = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        console.log("Token obtained inside App:", token);
        // We try to register it. If not logged in, this API call might fail or be queued (if interceptors handle it).
        // Ideally we should check isLoggedIn, but Hooks rules prevent us from easily accessing Context here 
        // without wrapping AppContent logic.
        // Actually, AppContent is inside AuthProvider, but 'App' root is outside.
        // The token registration should ideally happen INSIDE AppContent where we have 'isLoggedIn'.
        // BUT, registerForPushNotificationsAsync asks permission on mount.
        // Let's store it in a global or just rely on 'registerForPushNotificationsAsync' being cached by OS
        // and re-calling it inside AppContent.
      }
    };

    setupNotifications();
    registerBackgroundFetchAsync();

    return () => {
      // Optional: Unregister if desired, but usually we want background fetch to persist
      // unregisterBackgroundFetchAsync();
    };
  }, []);

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
