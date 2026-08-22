import { createElement, useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

import { GOOGLE_WEB_CLIENT_ID } from "@/config";
import { colors } from "@/theme";
import type { GoogleAuthButtonProps } from "./GoogleAuthButton.types";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback(response: GoogleCredentialResponse): void;
        auto_select: boolean;
        cancel_on_tap_outside: boolean;
        ux_mode: "popup";
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "outline";
          size: "large";
          text: "continue_with";
          shape: "rectangular";
          logo_alignment: "left";
          width: number;
        },
      ): void;
      cancel(): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  const scriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    const script = existingScript ?? document.createElement("script");

    const handleLoad = () => window.google?.accounts.id
      ? resolve()
      : reject(new Error("Google Identity Services did not initialize."));
    const handleError = () => reject(new Error("Google Identity Services could not be loaded."));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existingScript) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    googleScriptPromise = null;
    throw error;
  });

  googleScriptPromise = scriptPromise;
  return scriptPromise;
}

export function GoogleAuthButton({
  disabled = false,
  onCredential,
  onError,
}: GoogleAuthButtonProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    if (!GOOGLE_WEB_CLIENT_ID) {
      onError("Google Sign-In is not configured for Web yet.");
      return;
    }

    const render = () => {
      const host = hostRef.current;
      const google = window.google;
      if (!active || !host || !google) return;

      host.replaceChildren();
      google.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        callback: (response) => {
          if (!response.credential) {
            onError("Google did not return a valid sign-in credential.");
            return;
          }
          void onCredential(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: "popup",
      });
      google.accounts.id.renderButton(host, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: Math.min(Math.max(host.clientWidth, 240), 400),
      });
    };

    void loadGoogleIdentityServices().then(render).catch(() => {
      if (active) onError("Google Sign-In could not be loaded. Check your connection and try again.");
    });
    window.addEventListener("resize", render);

    return () => {
      active = false;
      window.removeEventListener("resize", render);
    };
  }, [onCredential, onError]);

  return (
    <View
      accessibilityLabel="Continue with Google"
      style={{
        minHeight: 44,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.62 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      {disabled ? <ActivityIndicator color={colors.brand} /> : null}
      {createElement("div", {
        ref: hostRef,
        style: {
          display: disabled ? "none" : "block",
          minHeight: 44,
          width: "100%",
        },
      })}
    </View>
  );
}
