import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let registeredToken: string | undefined;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface DeviceContextRegistration {
  timeZone: string;
  expoPushToken?: string;
  platform?: "android" | "ios";
}

const deviceTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";

export async function registerDeviceContext(): Promise<DeviceContextRegistration> {
  const timeZone = deviceTimeZone();
  if (Platform.OS !== "android" && Platform.OS !== "ios") return { timeZone };
  if (!Device.isDevice) return { timeZone };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages and reactions",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: "#04B9B4",
    });
    await Notifications.setNotificationChannelAsync("birthday", {
      name: "Birthdays",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: "#04B9B4",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted"
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return { timeZone };

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { timeZone };

  registeredToken = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;
  return {
    timeZone,
    expoPushToken: registeredToken,
    platform: Platform.OS,
  };
}

export const getRegisteredPushToken = (): string | undefined => registeredToken;

const responseUrl = (
  response: Notifications.NotificationResponse,
): string | undefined => {
  const url = response.notification.request.content.data?.url;
  return typeof url === "string" && (
    url === "/home" || /^\/chat\/[a-f\d]{24}$/i.test(url)
  ) ? url : undefined;
};

export function subscribeToNotificationResponses(
  onUrl: (url: string) => void,
): () => void {
  let active = true;
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!active || !response) return;
    const url = responseUrl(response);
    if (url) onUrl(url);
    void Notifications.clearLastNotificationResponseAsync();
  });
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const url = responseUrl(response);
      if (url) onUrl(url);
    },
  );
  return () => {
    active = false;
    subscription.remove();
  };
}
