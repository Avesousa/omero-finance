import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, onFinanceDenied, setActiveFinanceId } from "../../lib/api";
import { useSession } from "../../lib/session";
import { prefGet, prefSet } from "../../lib/storage";
import { selectableFinanceId } from "../../lib/finance-selection";
import type { FinanceDTO } from "../../lib/types";

export interface NewHomeInput {
  name: string;
  /** Clave de paleta (`violeta`, `azul`…). */
  color?: string;
}

interface ActiveFinanceState {
  /** false mientras se cargan las finanzas del usuario. */
  ready: boolean;
  finances: FinanceDTO[];
  /** Finanza que se está viendo. */
  active: FinanceDTO | null;
  /** Nombre de la finanza a la que se perdió el acceso (para avisar una vez); null si no pasó. */
  lostAccessTo: string | null;
  clearLostAccess: () => void;
  setActive: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  createHome: (input: NewHomeInput) => Promise<FinanceDTO>;
}

const Ctx = createContext<ActiveFinanceState | null>(null);
const prefKey = (userId: string) => `omero_finance_id:${userId}`;

interface FinancesResponse {
  finances: FinanceDTO[];
  activeId: string;
}

/**
 * Finanza activa. Va dentro de SessionProvider y por FUERA de ThemeProvider (el tema depende de ella).
 * Al cambiar de finanza las consultas usan otra clave (llevan su id): no se mezclan datos ni hace falta limpiar el caché.
 */
export function ActiveFinanceProvider({ children }: { children: ReactNode }) {
  const { signedIn, user } = useSession();
  const [ready, setReady] = useState(false);
  const [finances, setFinances] = useState<FinanceDTO[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [lostAccessTo, setLostAccessTo] = useState<string | null>(null);
  const financesRef = useRef<FinanceDTO[]>([]);
  financesRef.current = finances;
  const userId = user?.id ?? null;

  const apply = useCallback(
    async (id: string | null) => {
      setActiveFinanceId(id);
      setActiveIdState(id);
      if (userId) await prefSet(prefKey(userId), id ?? "");
    },
    [userId],
  );

  const load = useCallback(
    async (preferred?: string | null) => {
      if (preferred !== undefined) setActiveFinanceId(preferred || null);
      const res = await api<FinancesResponse>("GET", "/api/plan/finances");
      setFinances(res.finances);
      // El servidor valida el header: si la guardada ya no sirve, devuelve la de por defecto.
      if (preferred && preferred !== res.activeId) {
        const lost = financesRef.current.find((f) => f.id === preferred);
        setLostAccessTo(lost?.name ?? "esa finanza");
      }
      await apply(selectableFinanceId(res));
      return res;
    },
    [apply],
  );

  // Al iniciar sesión: restaurar la última finanza elegida (por usuario) y cargar la lista.
  useEffect(() => {
    if (!signedIn || !userId) {
      setActiveFinanceId(null);
      setActiveIdState(null);
      setFinances([]);
      setReady(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const saved = await prefGet(prefKey(userId));
        if (!alive) return;
        await load(saved);
      } catch {
        // Sin red o error: la app sigue con la finanza por defecto del servidor (sin header).
        if (alive) setActiveFinanceId(null);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [signedIn, userId, load]);

  const setActive = useCallback(
    async (id: string) => {
      if (id === activeId) return;
      await apply(id);
    },
    [activeId, apply],
  );

  const refresh = useCallback(async () => {
    await load(undefined);
  }, [load]);

  const createHome = useCallback(
    async (input: NewHomeInput) => {
      const res = await api<{ finance: FinanceDTO }>("POST", "/api/plan/finances", input);
      await load(undefined);
      await apply(res.finance.id);
      return res.finance;
    },
    [load, apply],
  );

  // 403 "No tenés acceso a esa finanza" en cualquier pedido: volver a Personal y avisar.
  useEffect(() => {
    onFinanceDenied(() => {
      const current = financesRef.current;
      const lost = current.find((f) => f.id === activeId);
      const personal = current.find((f) => f.kind === "PERSONAL" && f.isOwner);
      if (lost) setLostAccessTo(lost.name);
      // Se sigue con la default del servidor (sin header) y se recarga la lista.
      setActiveFinanceId(personal?.id ?? null);
      load(personal?.id ?? null).catch(() => {});
    });
    return () => onFinanceDenied(null);
  }, [activeId, load]);

  const active = useMemo(() => finances.find((f) => f.id === activeId) ?? null, [finances, activeId]);
  const clearLostAccess = useCallback(() => setLostAccessTo(null), []);

  const value = useMemo(
    () => ({ ready, finances, active, lostAccessTo, clearLostAccess, setActive, refresh, createHome }),
    [ready, finances, active, lostAccessTo, clearLostAccess, setActive, refresh, createHome],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Igual que `useActiveFinance` pero devuelve null fuera del provider (lo usa el tema). */
export function useActiveFinanceOptional(): ActiveFinanceState | null {
  return useContext(Ctx);
}

/** false si el rol en la finanza activa es Lector (oculta Cargar, editar y borrar; el servidor igual lo impide). */
export function useCanWrite(): boolean {
  return useContext(Ctx)?.active?.role !== "VIEWER";
}

export function useActiveFinance(): ActiveFinanceState {
  const v = useContext(Ctx);
  if (!v) throw new Error("ActiveFinanceProvider faltante");
  return v;
}
