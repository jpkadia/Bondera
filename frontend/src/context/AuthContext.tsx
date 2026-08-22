import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEMO_MODE } from "@/config";
import { demoUser } from "@/data/demo";
import { api, configureApi, type SignupDetails } from "@/services/api";
import { clearSession, loadSession, saveSession } from "@/services/sessionStorage";
import type { Session, User } from "@/types/api";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  isDemo: boolean;
  login(identifier: string, password: string): Promise<void>;
  updateProfile(input: { fullName: string; username: string }): Promise<void>;
  requestEmailChange(email: string): Promise<{ expiresAt: string; retryAfterSeconds: number }>;
  verifyEmailChange(email: string, otp: string): Promise<void>;
  loginWithGoogle(idToken: string): Promise<void>;
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
        try {
          const fresh = await api.refresh(stored.tokens.refreshToken);
          if (mounted) applySession(fresh);
        } catch {
          await clearSession();
          configureApi(null);
        }
      }
      if (mounted) setIsBootstrapping(false);
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

  const updateProfile = useCallback(async (input: { fullName: string; username: string }) => {
    if (isDemo) {
      setSession((current) => current ? {
        ...current,
        user: { ...current.user, fullName: input.fullName || undefined, username: input.username },
      } : current);
      return;
    }
    replaceUser(await api.updateProfile(input));
  }, [isDemo, replaceUser]);

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

  const loginWithGoogle = useCallback(async (idToken: string) => {
    configureApi(null);
    const next = await api.googleLogin(idToken);
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
    setSession(null);
    setIsDemo(false);
    configureApi(null);
    await clearSession();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    accessToken: isDemo ? null : session?.tokens.accessToken ?? null,
    isBootstrapping,
    isDemo,
    login,
    updateProfile,
    requestEmailChange,
    verifyEmailChange,
    loginWithGoogle,
    signup,
    enterDemo,
    logout,
  }), [enterDemo, isBootstrapping, isDemo, login, loginWithGoogle, logout, requestEmailChange, session, signup, updateProfile, verifyEmailChange]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
