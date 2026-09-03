import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

import { useAuth } from "@/context/AuthContext";
import {
  RealtimeClient,
  type RealtimeEvents,
} from "@/services/socket";

interface RealtimeContextValue {
  realtime: RealtimeClient;
  subscribe(events: RealtimeEvents): () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isDemo, refreshCurrentUser } = useAuth();
  const [realtime] = useState(() => new RealtimeClient());
  const refreshingSession = useRef(false);

  useEffect(() => {
    if (accessToken && !isDemo) realtime.connect(accessToken);
    else realtime.disconnect();

    return () => realtime.disconnect();
  }, [accessToken, isDemo, realtime]);

  useEffect(
    () =>
      realtime.subscribe({
        onConnectError: () => {
          if (!accessToken || isDemo || refreshingSession.current) return;
          refreshingSession.current = true;
          void refreshCurrentUser()
            .catch(() => undefined)
            .finally(() => {
              refreshingSession.current = false;
            });
        },
      }),
    [accessToken, isDemo, realtime, refreshCurrentUser],
  );

  useEffect(() => {
    let appActive = AppState.currentState === "active";
    let documentVisible =
      Platform.OS !== "web" ||
      typeof document === "undefined" ||
      document.visibilityState === "visible";
    const updatePresence = () => realtime.setPresence(appActive && documentVisible);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      appActive = state === "active";
      updatePresence();
    });
    const handleVisibility = () => {
      documentVisible = document.visibilityState === "visible";
      updatePresence();
    };

    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }
    updatePresence();

    return () => {
      appStateSubscription.remove();
      if (Platform.OS === "web" && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [realtime]);

  const subscribe = useCallback(
    (events: RealtimeEvents) => realtime.subscribe(events),
    [realtime],
  );
  const value = useMemo(
    () => ({ realtime, subscribe }),
    [realtime, subscribe],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error("useRealtime must be used within RealtimeProvider.");
  return context;
}
