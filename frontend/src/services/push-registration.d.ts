export interface DeviceContextRegistration {
  timeZone: string;
  expoPushToken?: string;
  platform?: "android" | "ios";
}

export declare function registerDeviceContext(): Promise<DeviceContextRegistration>;
export declare function getRegisteredPushToken(): string | undefined;
export declare function subscribeToNotificationResponses(
  onUrl: (url: string) => void,
): () => void;
