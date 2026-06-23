/**
 * App.tsx
 *
 * Root of the Hearing Trigger app.
 * - Bootstraps the audio bridge (listens for native KWS events)
 * - Sets up bottom-tab navigation
 * - Wraps everything in PermissionGate
 */
import React, {useEffect} from 'react';
import {StatusBar, Text} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {HomeScreen}     from './src/screens/HomeScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {HistoryScreen}  from './src/screens/HistoryScreen';
import {PermissionGate} from './src/components/PermissionGate';
import {startAudioBridge} from './src/services/audioBridge';
import {COLORS} from './src/config/colors';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, {active: string; inactive: string}> = {
  Home:     {active: '🎙',  inactive: '🎙'},
  History:  {active: '🕘',  inactive: '🕘'},
  Settings: {active: '⚙️', inactive: '⚙️'},
};

export default function App() {
  useEffect(() => {
    startAudioBridge();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.neutral} />
      <PermissionGate>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({route}) => ({
              headerStyle: {backgroundColor: COLORS.neutral},
              headerTintColor: COLORS.tertiary,
              tabBarStyle: {backgroundColor: COLORS.neutral, borderTopColor: COLORS.grayLight},
              tabBarActiveTintColor: COLORS.primary,
              tabBarInactiveTintColor: COLORS.tertiary,
              tabBarIcon: ({focused, color}) => {
                const icons = TAB_ICONS[route.name] ?? {active: '●', inactive: '○'};
                return (
                  <Text style={{fontSize: 20, color, opacity: focused ? 1 : 0.6}}>
                    {focused ? icons.active : icons.inactive}
                  </Text>
                );
              },
            })}>
            <Tab.Screen
              name="Home"
              component={HomeScreen}
              options={{title: 'Listen'}}
            />
            <Tab.Screen
              name="History"
              component={HistoryScreen}
              options={{title: 'History'}}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{title: 'Settings'}}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </PermissionGate>
    </SafeAreaProvider>
  );
}
