/**
 * App.tsx
 *
 * Root of the Hearing Trigger app.
 * - Bootstraps the audio bridge (listens for native KWS events)
 * - Sets up bottom-tab navigation
 * - Wraps everything in PermissionGate
 */
import React, { useEffect } from "react";
import { StatusBar, TouchableOpacity, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { HomeScreen } from "./src/screens/HomeScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { PermissionGate } from "./src/components/PermissionGate";
import { startAudioBridge } from "./src/services/audioBridge";
import { COLORS } from "./src/config/colors";

const Tab = createBottomTabNavigator();

function AppNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.neutral }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: true,
          headerTitleAlign: "center",
          headerStyle: {
            backgroundColor: COLORS.neutral,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: COLORS.grayBorder,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: "600",
            color: "#FFFFFF",
          },
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            position: "absolute",
            bottom: 24,
            left: 20,
            right: 20,
            height: 64,
            borderRadius: 20,
            backgroundColor: "rgba(17, 34, 64, 0.92)",
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: "rgba(56, 189, 248, 0.15)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 8,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: COLORS.secondary,
          tabBarInactiveTintColor: "#64748B",
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
          },
          tabBarIcon: ({ focused, color }) => {
            let iconName = "";
            if (route.name === "Home") {
              iconName = focused ? "mic" : "mic-outline";
            } else if (route.name === "History") {
              iconName = focused ? "time" : "time-outline";
            } else if (route.name === "Settings") {
              iconName = focused ? "settings" : "settings-outline";
            }
            return <Ionicons name={iconName} size={22} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Listen" }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: "History" }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: "Settings" }}
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.neutral} />
      <PermissionGate>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </PermissionGate>
    </SafeAreaProvider>
  );
}
