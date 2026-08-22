import { Platform } from "react-native";

const localHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${localHost}:5000/api`;
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? `http://${localHost}:5000`;
export const DEMO_MODE = __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === "true";
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
export const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
