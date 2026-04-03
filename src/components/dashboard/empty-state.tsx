import { CalendarX, Clock } from "lucide-react";
import type { MonthName } from "@/lib/months";

interface EmptyStateProps {
  month: MonthName;
  year: number;
  isFuture: boolean;
}

export function EmptyState({ month, year, isFuture }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 px-6 py-16 rounded-2xl border"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          backgroundColor: "var(--bg-elevated)",
          color: isFuture ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        {isFuture ? <Clock size={28} /> : <CalendarX size={28} />}
      </div>

      <div className="text-center space-y-2">
        <p className="text-base font-semibold capitalize" style={{ color: "var(--text-primary)" }}>
          {month} {year}
        </p>

        {isFuture ? (
          <>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Este mes todavía no comenzó
            </p>
            <p className="text-xs max-w-[240px]" style={{ color: "var(--text-secondary)" }}>
              Podés volver acá cuando llegue {month} para registrar ingresos y gastos.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Sin datos para este mes
            </p>
            <p className="text-xs max-w-[240px]" style={{ color: "var(--text-secondary)" }}>
              No se registraron ingresos ni gastos en {month} {year}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
