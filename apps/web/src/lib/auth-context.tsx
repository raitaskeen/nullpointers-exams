"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthUser, LoginInput, RegisterInput } from "@np/shared";
import { ApiError, api } from "./api-client";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  hasRole: (role: string) => boolean;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session state comes from the server (`/api/auth/me`), never from storage: the session lives in an
 * httpOnly cookie that JavaScript can't read, so XSS can't steal it.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await api<{ user: AuthUser }>("/auth/me");
      setUser(me);
      return me;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) console.error(err);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      refresh,
      async login(input) {
        const { user: me } = await api<{ user: AuthUser }>("/auth/login", { method: "POST", json: input });
        queryClient.clear();
        setUser(me);
        return me;
      },
      async register(input) {
        const { user: me } = await api<{ user: AuthUser }>("/auth/register", { method: "POST", json: input });
        queryClient.clear();
        setUser(me);
        return me;
      },
      async logout() {
        await api("/auth/logout", { method: "POST" }).catch(() => {});
        queryClient.clear();
        setUser(null);
      },
      hasRole: (role) => user?.roles.includes(role) ?? false,
      can: (permission) => user?.permissions.includes(permission) ?? false,
    }),
    [user, isLoading, refresh, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
