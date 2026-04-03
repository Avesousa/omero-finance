"use client";

import { TrendingUp } from "lucide-react";

export interface RecentIncome {
  id: string;
  type: string;
  amount: number;
  currency: "ARS" | "USD";
  description: string | null;
  createdByName: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  SUELDO:     "Sueldo",
  FREELANCE:  "Freelance",
  AHORROS:    "Ahorros",
  PAGO_DEUDA: "Pago deuda",
  REMANENTES: "Remanentes",
  PRESTAMO:   "Préstamo",
  INVERSION:  "Inversión",
};

function relativeTime(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ayer" : `hace ${days}d`;
}

export function RecentIncomes({ incomes }: { incomes: RecentIncome[] }) {
  if (incomes.length === 0) {
    return (
      <p className="text-center py-8 text-sm" style={{ color: "var(--text-secondary)" }}>
        Sin ingresos registrados este mes
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {incomes.map((inc) => (
        <div
          key={inc.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: "var(--bg-card)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "var(--accent-green)" }}
          >
            <TrendingUp size={14} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {inc.description || TYPE_LABELS[inc.type] || inc.type}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {inc.createdByName} · {TYPE_LABELS[inc.type] || inc.type} · {relativeTime(inc.createdAt)}
            </p>
          </div>

          <p className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--accent-green)" }}>
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: inc.currency === "USD" ? "USD" : "ARS",
              maximumFractionDigits: 0,
            }).format(inc.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}
