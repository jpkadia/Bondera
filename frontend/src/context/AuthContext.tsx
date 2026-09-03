import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEMO_MODE } from "@/config";
import type { GoogleCredential } from "@/components/GoogleAuthButton.types";
import { demoUser } from "@/data/demo";
import { ApiError, api, configureApi, type SignupDetails } from "@/services/api";
import { clearChatSnapshots } from "@/services/chat-cache";
import { clearSession, loadSession, saveSession } from "@/services/sessionStorage";
import {
  getRegisteredPushToken,
  registerDeviceContext,
} from "@/services/push-registration";
import type { Session, User } from "@/types/api";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  isDemo: boolean;
  login(identifier: string, password: string): Promise<void>;
  refreshCurrentUser(): Promise<void>;
  updateProfile(input: {
    fullName: string;
    username: string;
    birthDate?: string;
  }): Promise<void>;
  completeBirthDate(birthDate: string): Promise<void>;
  updateProfilePicture(form: FormData): Promise<{ cleanupPending: boolean }>;
  removeProfilePicture(): Promise<{ cleanupPending: boolean }>;
  requestEmailChange(email: string): Promise<{ expiresAt: string; retryAfterSeconds: number }>;
  verifyEmailChange(email: string, otp: string): Promise<void>;
  loginWithGoogle(credential: GoogleCredential): Promise<void>;
  signup(details: SignupDetails, otp: string): Promise<void>;
  enterDemo(): void;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const commitSession = useCallback((next: Session) => {
    setSession(next);
    void saveSession(next);
  }, []);

  const applySession = useCallback((next: Session) => {
    commitSession(next);
    configureApi(next.tokens, commitSession);
  }, [commitSession]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await loadSession();
      if (!mounted) return;
      if (stored) {
        configureApi(stored.tokens, applySession);
        setSession(stored);
        setIsBootstrapping(false);
        try {
          const fresh = await api.refresh(stored.tokens.refreshToken);
          if (mounted) applySession(fresh);
        } catch (error) {
          if (error instanceof ApiError && [401, 403].includes(error.status)) {
            await clearSession();
            clearChatSnapshots();
            configureApi(null);
            if (mounted) setSession(null);
          }
        }
      }
      if (mounted && !stored) setIsBootstrapping(false);
    })();
    return () => { mounted = false; };
  }, [applySession]);

  const login = useCallback(async (identifier: string, password: string) => {
    configureApi(null);
    const next = await api.login(identifier, password);
    setIsDemo(false);
    applySession(next);
  }, [applySession]);

  const replaceUser = useCallback((user: User) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user };
      void saveSession(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!session?.user.birthDate || !session.tokens.accessToken || isDemo) return;
    let active = true;
    void registerDeviceContext()
      .then((context) => api.syncDeviceContext(context))
      .then((user) => {
        if (active && user.timeZone !== session.user.timeZone) replaceUser(user);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isDemo, replaceUser, session?.tokens.accessToken, session?.user.birthDate, session?.user.id, session?.user.timeZone]);

  const updateProfile = useCallback(async (input: {
    fullName: string;
    username: string;
    birthDate?: string;
  }) => {
    if (isDemo) {
      setSession((current) => current ? {
        ...current,
        user: {
          ...current.user,
          fullName: input.fullName || undefined,
          username: input.username,
          birthDate: input.birthDate ?? current.user.birthDate,
        },
      } : current);
      return;
    }
    replaceUser(await api.updateProfile(input));
  }, [isDemo, replaceUser]);

  const refreshCurrentUser = useCallback(async () => {
    if (isDemo) return;
    replaceUser(await api.me());
  }, [isDemo, replaceUser]);

  const completeBirthDate = useCallback(async (birthDate: string) => {
    if (isDemo) {
      setSession((current) => current ? {
        ...current,
        user: { ...current.user, birthDate },
      } : current);
      return;
    }
    replaceUser(await api.completeBirthDate(birthDate));
  }, [isDemo, replaceUser]);

  const updateProfilePicture = useCallback(async (form: FormData) => {
    const result = await api.uploadProfilePicture(form);
    replaceUser(result.user);
    return { cleanupPending: result.previousCleanupPending };
  }, [replaceUser]);

  const removeProfilePicture = useCallback(async () => {
    const result = await api.removeProfilePicture();
    replaceUser(result.user);
    return { cleanupPending: result.cleanupPending };
  }, [replaceUser]);

  const requestEmailChange = useCallback(
    (email: string) => api.requestEmailChange(email),
    [],
  );

  const verifyEmailChange = useCallback(async (email: string, otp: string) => {
    replaceUser(await api.verifyEmailChange(email, otp));
  }, [replaceUser]);

  const signup = useCallback(async (details: SignupDetails, otp: string) => {
    configureApi(null);
    const next = await api.verifySignup(details, otp);
    setIsDemo(false);
    applySession(next);
  }, [applySession]);

  const loginWithGoogle = useCallback(async (credential: GoogleCredential) => {
    configureApi(null);
    const next = await api.googleLogin(credential);
    setIsDemo(false);
    applySession(next);
  }, [applySession]);

  const enterDemo = useCallback(() => {
    if (!DEMO_MODE) return;
    setIsDemo(true);
    setSession({
      user: demoUser,
      tokens: { tokenType: "Bearer", accessToken: "demo", refreshToken: "demo" },
    });
    configureApi(null);
  }, []);

  const logout = useCallback(async () => {
    const expoPushToken = getRegisteredPushToken();
    if (expoPushToken && !isDemo) {
      await api.unregisterDevice(expoPushToken).catch(() => undefined);
    }
    setSession(null);
    setIsDemo(false);
    clearChatSnapshots();
    configureApi(null);
    await clearSession();
  }, [isDemo]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    accessToken: isDemo ? null : session?.tokens.accessToken ?? null,
    isBootstrapping,
    isDemo,
    login,
    refreshCurrentUser,
    updateProfile,
    completeBirthDate,
    updateProfilePicture,
    removeProfilePicture,
    requestEmailChange,
    verifyEmailChange,
    loginWithGoogle,
    signup,
    enterDemo,
    logout,
  }), [completeBirthDate, enterDemo, isBootstrapping, isDemo, login, loginWithGoogle, logout, refreshCurrentUser, removeProfilePicture, requestEmailChange, session, signup, updateProfile, updateProfilePicture, verifyEmailChange]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
