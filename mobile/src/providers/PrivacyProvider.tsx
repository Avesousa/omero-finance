import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { prefGet, prefSet } from "../../lib/storage";

export const PRIVACY_STORAGE_KEY = "omero_privacy_hidden";

export interface PrivacyContextValue {
  /** true = los montos se muestran como "••••" (el ojito de Inicio). Mientras se lee la preferencia guardada, también true: nunca se ven montos de más. */
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  toggleHidden: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

/** Preferencia central "ocultar montos" (ojito), guardada por dispositivo. Cualquier pantalla la lee con `usePrivacy()`. */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    prefGet(PRIVACY_STORAGE_KEY)
      .then((saved) => {
        if (alive && saved === "1") setHiddenState(true);
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const setHidden = useCallback((next: boolean) => {
    setHiddenState(next);
    void prefSet(PRIVACY_STORAGE_KEY, next ? "1" : "0");
  }, []);

  const toggleHidden = useCallback(() => {
    setHiddenState((prev) => {
      void prefSet(PRIVACY_STORAGE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }, []);

  const value = useMemo<PrivacyContextValue>(() => {
    // Hasta leer la preferencia, tratamos los montos como ocultos (sin parpadeo de montos si el usuario los tenía ocultos).
    const effective = ready ? hidden : true;
    return { hidden: effective, setHidden, toggleHidden };
  }, [ready, hidden, setHidden, toggleHidden]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error("usePrivacy debe usarse dentro de PrivacyProvider");
  return ctx;
}
