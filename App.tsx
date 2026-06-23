/**
 * App.tsx
 *
 * Root of the Hearing Trigger app.
 * - Bootstraps the audio bridge (listens for native KWS events)
 * - Sets up bottom-tab navigation
 * - Wraps everything in PermissionGate
 */
import React, { useEffect } from 'react';
import { StatusBar, Text, View, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { PermissionGate } from './src/components/PermissionGate';
import { startAudioBridge } from './src/services/audioBridge';
import { COLORS } from './src/config/colors';
import { MicIcon, ClockIcon, GearIcon } from './src/components/Icons';

const Tab = createBottomTabNavigator();

// Custom TabIcon wrapper pointing to centralized vector icon components
function TabIcon({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  if (name === 'Home') {
    return <MicIcon size={size} color={color} />;
  }
  if (name === 'History') {
    return <ClockIcon size={size} color={color} />;
  }
  if (name === 'Settings') {
    return <GearIcon size={size} color={color} />;
  }
  return null;
}

export default function App() {
  useEffect(() => {
    startAudioBridge();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <PermissionGate>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerStyle: {
                backgroundColor: '#FFFFFF',
                elevation: 0,
                shadowOpacity: 0,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              },
              headerTitleStyle: {
                fontSize: 20,
                fontWeight: '800',
                color: '#1F2937',
              },
              headerTitleAlign: 'center',
              tabBarStyle: {
                backgroundColor: '#FFFFFF',
                borderTopWidth: 1,
                borderTopColor: '#F3F4F6',
                height: 62,
                paddingBottom: 8,
                paddingTop: 8,
              },
              tabBarActiveTintColor: COLORS.primary,
              tabBarInactiveTintColor: COLORS.tertiary,
              tabBarIcon: ({ color }) => {
                return <TabIcon name={route.name} color={color} size={22} />;
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
        </NavigationContainer>
      </PermissionGate>
    </SafeAreaProvider>
  );
}
