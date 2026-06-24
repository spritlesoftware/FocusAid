/**
 * App.tsx
 *
 * Root of the Hearing Trigger app.
 * - Bootstraps the audio bridge (listens for native KWS events)
 * - Sets up bottom-tab navigation
 * - Wraps everything in PermissionGate
 */
import React, { useEffect } from 'react';
import { StatusBar, TouchableOpacity, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { PermissionGate } from './src/components/PermissionGate';
import { startAudioBridge } from './src/services/audioBridge';
import { COLORS } from './src/config/colors';

const Tab = createBottomTabNavigator();

function AppNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: COLORS.white,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: '#E5E7EB',
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: '600',
            color: '#1F2937',
          },
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: COLORS.white,
            borderTopColor: '#f0e5ec',
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom + 6 : 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.tertiary,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
          },
          tabBarIcon: ({ focused, color }) => {
            let iconName = '';
            if (route.name === 'Home') {
              iconName = focused ? 'mic' : 'mic-outline';
            } else if (route.name === 'History') {
              iconName = focused ? 'time' : 'time-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }
            return <Ionicons name={iconName} size={22} color={color} />;
          },
        })}>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Listen' }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: 'History' }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Tab.Navigator>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    startAudioBridge();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.neutral} />
      <PermissionGate>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </PermissionGate>
    </SafeAreaProvider>
  );
}
