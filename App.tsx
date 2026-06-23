/**
 * App.tsx
 *
 * Root of the Hearing Trigger app.
 * - Bootstraps the audio bridge (listens for native KWS events)
 * - Sets up bottom-tab navigation
 * - Wraps everything in PermissionGate
 */
import React, {useEffect} from 'react';
import {StatusBar, TouchableOpacity} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider, useSafeAreaInsets, SafeAreaView} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {HomeScreen}     from './src/screens/HomeScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {HistoryScreen}  from './src/screens/HistoryScreen';
import {PermissionGate} from './src/components/PermissionGate';
import {startAudioBridge} from './src/services/audioBridge';
import {COLORS} from './src/config/colors';

const Tab = createBottomTabNavigator();

function AppNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }} edges={['top']}>
      <Tab.Navigator
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.white,
            borderTopColor: '#f0e5ec',
            borderTopWidth: 1,
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.tertiary,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
          },
          tabBarIcon: ({focused, color}) => {
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
          tabBarButton: (props) => {
            const isFocused = props.accessibilityState?.selected;
            return (
              <TouchableOpacity
                {...props}
                style={[
                  props.style,
                  {
                    borderTopWidth: 3,
                    borderTopColor: isFocused ? COLORS.primary : 'transparent',
                    marginTop: -1,
                    paddingTop: 6,
                  }
                ]}
              />
            );
          }
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
    </SafeAreaView>
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
