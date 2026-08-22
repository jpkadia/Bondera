import type { ConfigContext, ExpoConfig } from "expo/config";

const IOS_CLIENT_SUFFIX = ".apps.googleusercontent.com";

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const plugins = [...(config.plugins ?? [])];

  if (iosClientId?.endsWith(IOS_CLIENT_SUFFIX)) {
    const clientPrefix = iosClientId.slice(0, -IOS_CLIENT_SUFFIX.length);
    plugins.push([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: `com.googleusercontent.apps.${clientPrefix}` },
    ]);
  }

  return {
    ...config,
    name: config.name ?? "Bondera",
    slug: config.slug ?? "bondera",
    plugins,
  };
};
