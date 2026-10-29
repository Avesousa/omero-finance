import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { addMonths, currentPeriod } from "./core";

interface PeriodState {
  period: string;
  setPeriod: (p: string) => void;
  prev: () => void;
  next: () => void;
}

const Ctx = createContext<PeriodState | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState(() => currentPeriod());
  const value = useMemo<PeriodState>(
    () => ({
      period,
      setPeriod,
      prev: () => setPeriod((p) => addMonths(p, -1)),
      next: () => setPeriod((p) => addMonths(p, 1)),
    }),
    [period],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePeriod(): PeriodState {
  const v = useContext(Ctx);
  if (!v) throw new Error("PeriodProvider faltante");
  return v;
}
