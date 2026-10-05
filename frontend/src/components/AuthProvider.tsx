"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, refreshSession, setAuthLostHandler } from "@/lib/api";
import type { AuthResponse, UserResponse } from "@/lib/api-types";
import { clearAccessToken, setAccessToken } from "@/lib/auth-token";

/** loading: 새로고침 직후 Refresh 쿠키로 복구를 시도하는 중. 이 동안은 로그인/로그아웃 버튼을 보여 주지 않는다. */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: UserResponse | null;
  /** 구글 ID 토큰으로 로그인한다. 실패하면 ApiError를 던진다. */
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 재발급까지 실패해 로그인이 풀리면(다른 곳에서 로그아웃, 토큰 재사용 탐지 등) 화면도 로그아웃 상태로 맞춘다.
    setAuthLostHandler(() => {
      setUser(null);
      setStatus("anonymous");
    });

    // Access 토큰은 메모리에만 있어 새로고침하면 사라진다. httpOnly Refresh 쿠키로 조용히 복구한다.
    // refreshSession은 동시에 불려도 요청 1개만 보내므로(single-flight) 개발 모드의 effect 이중 실행도 안전하다.
    void refreshSession().then((auth) => {
      if (cancelled) {
        return;
      }
      setUser(auth ? auth.user : null);
      setStatus(auth ? "authenticated" : "anonymous");
    });

    return () => {
      cancelled = true;
      setAuthLostHandler(null);
    };
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    // auth:false = 아직 토큰이 없으므로 Authorization 헤더를 붙이지 않고, 401이어도 재발급을 시도하지 않는다.
    const auth = await apiFetch<AuthResponse>("/auth/google", {
      method: "POST",
      body: { idToken },
      auth: false,
    });
    setAccessToken(auth.accessToken);
    setUser(auth.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST", auth: false });
    } catch {
      // 서버 호출이 실패해도 이 기기에서는 로그아웃 상태로 만든다(토큰은 어차피 메모리에만 있다).
    } finally {
      clearAccessToken();
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, loginWithGoogle, logout }),
    [status, user, loginWithGoogle, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다.");
  }
  return context;
}
