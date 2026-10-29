import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, loadToken, onUnauthorized, setToken } from "./api";
import { prefGet, prefSet } from "./storage";
import type { SessionUser } from "./types";

interface SessionState {
  /** false mientras se lee el token guardado. */
  ready: boolean;
  signedIn: boolean;
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);
const USER_KEY = "omero_user";

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await loadToken();
      let saved: SessionUser | null = null;
      try {
        const raw = await prefGet(USER_KEY);
        saved = raw ? (JSON.parse(raw) as SessionUser) : null;
      } catch {
        saved = null;
      }
      if (!alive) return;
      setUser(token ? saved : null);
      setSignedIn(!!token);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 401 en cualquier pedido: sesión vencida, volver al login.
  useEffect(() => {
    onUnauthorized(() => {
      qc.clear();
      setSignedIn(false);
      setUser(null);
    });
    return () => onUnauthorized(null);
  }, [qc]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: SessionUser }>("POST", "/api/auth/login", { email, password });
    await setToken(res.token);
    await prefSet(USER_KEY, JSON.stringify(res.user));
    qc.clear();
    setUser(res.user);
    setSignedIn(true);
  }, [qc]);

  const signOut = useCallback(async () => {
    try {
      await api("POST", "/api/auth/logout");
    } catch {
      /* si no hay red igual cerramos acá */
    }
    await setToken(null);
    qc.clear();
    setSignedIn(false);
    setUser(null);
  }, [qc]);

  const value = useMemo(() => ({ ready, signedIn, user, signIn, signOut }), [ready, signedIn, user, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("SessionProvider faltante");
  return v;
}
