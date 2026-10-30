import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { prefGet, prefSet } from "../../lib/storage";
import { DEFAULT_MASCOT, isMascotId } from "./registry";
import type { MascotId } from "./types";

export const MASCOT_STORAGE_KEY = "omero_mascot";

interface MascotState {
  /** Mascota elegida por la persona (default 'omero'). */
  mascotId: MascotId;
  setMascotId: (id: MascotId) => void;
}

const Ctx = createContext<MascotState | null>(null);

/** Mascota elegida, persistida en AsyncStorage. No renderiza hijos hasta leerla (sin parpadeo). */
export function MascotProvider({ children }: { children: ReactNode }) {
  const [mascotId, setState] = useState<MascotId>(DEFAULT_MASCOT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    prefGet(MASCOT_STORAGE_KEY).then((saved) => {
      if (!alive) return;
      if (saved && isMascotId(saved)) setState(saved);
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setMascotId = useCallback((id: MascotId) => {
    setState(id);
    prefSet(MASCOT_STORAGE_KEY, id);
  }, []);

  const value = useMemo(() => ({ mascotId, setMascotId }), [mascotId, setMascotId]);
  if (!hydrated) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `{ mascotId, setMascotId }` de la mascota elegida. */
export function useMascot(): MascotState {
  const v = useContext(Ctx);
  if (!v) throw new Error("MascotProvider faltante");
  return v;
}
