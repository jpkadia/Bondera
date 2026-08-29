export interface DeviceContextRegistration {
  timeZone: string;
  expoPushToken?: string;
  platform?: "android" | "ios";
}

export async function registerDeviceContext(): Promise<DeviceContextRegistration> {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  };
}

export const getRegisteredPushToken = (): undefined => undefined;

export const subscribeToNotificationResponses = (
  _onUrl: (url: string) => void,
): (() => void) => () => undefined;
