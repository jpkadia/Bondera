import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ThemeProvider } from "styled-components/native";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { subscribeToNotificationResponses } from "@/services/push-registration";
import { theme } from "@/theme";

export default function RootLayout() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <NotificationProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { isBootstrapping, user } = useAuth();
  const signedOut = !isBootstrapping && !user;
  const needsBirthDate = !isBootstrapping && Boolean(user && !user.birthDate);
  const profileComplete = !isBootstrapping && Boolean(user?.birthDate);

  useEffect(() => {
    if (!profileComplete) return;
    return subscribeToNotificationResponses((url) => {
      router.push(url as "/home" | `/chat/${string}`);
    });
  }, [profileComplete]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />

      <Stack.Protected guard={signedOut}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>

      <Stack.Protected guard={needsBirthDate}>
        <Stack.Screen name="complete-birthdate" />
      </Stack.Protected>

      <Stack.Protected guard={profileComplete}>
        <Stack.Screen name="home" />
        <Stack.Screen name="chat/[connectionId]" />
        <Stack.Screen name="ai" />
      </Stack.Protected>
    </Stack>
  );
}

