import {
  GoogleSignin,
  GoogleSigninButton,
  isErrorWithCode,
} from "@react-native-google-signin/google-signin";
import { Platform, View } from "react-native";

import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@/config";
import type { GoogleAuthButtonProps } from "./GoogleAuthButton.types";

let configured = false;

function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  });
  configured = true;
}

export function GoogleAuthButton({
  disabled = false,
  onCredential,
  onError,
}: GoogleAuthButtonProps) {
  const signIn = async () => {
    const platformClientId = Platform.OS === "ios"
      ? GOOGLE_IOS_CLIENT_ID
      : GOOGLE_ANDROID_CLIENT_ID;

    if (!GOOGLE_WEB_CLIENT_ID || !platformClientId) {
      onError(`Google Sign-In is not configured for ${Platform.OS} yet.`);
      return;
    }

    try {
      configureGoogleSignIn();
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      if (response.type === "cancelled") return;
      if (!response.data.idToken) {
        onError("Google did not return a valid sign-in credential.");
        return;
      }
      await onCredential({ idToken: response.data.idToken });
    } catch (error) {
      const detail = isErrorWithCode(error) ? ` (${error.code})` : "";
      onError(`Google Sign-In failed${detail}. Please try again.`);
    }
  };

  return (
    <View style={{ minHeight: 48, width: "100%", alignItems: "center" }}>
      <GoogleSigninButton
        accessibilityLabel="Continue with Google"
        color={GoogleSigninButton.Color.Light}
        disabled={disabled}
        onPress={signIn}
        size={GoogleSigninButton.Size.Wide}
        style={{ width: "100%", height: 48 }}
      />
    </View>
  );
}
