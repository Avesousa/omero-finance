"use client";

import { ShoppingCart, Wrench, Zap, HelpCircle } from "lucide-react";

export interface RecentExpense {
  id: string;
  description: string;
  amount: number;
  currency: "ARS" | "USD";
  category: string;
  createdByName: string;
  createdAt: string; // ISO string
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  mercado: <ShoppingCart size={14} />,
  fijo: <Wrench size={14} />,
  general: <Zap size={14} />,
  personal: <HelpCircle size={14} />,
};

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  return `hace ${days}d`;
}

interface RecentExpensesProps {
  expenses: RecentExpense[];
}

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  if (expenses.length === 0) {
    return (
      <p className="text-center py-8 text-sm" style={{ color: "var(--text-secondary)" }}>
        Sin gastos registrados este mes
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {expenses.map((exp) => (
        <div
          key={exp.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: "var(--bg-card)" }}
        >
          {/* Icon */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "var(--bg-elevated)",
              color: "var(--text-secondary)",
            }}
          >
            {CATEGORY_ICON[exp.category] ?? <HelpCircle size={14} />}
          </div>

          {/* Description */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {exp.description || exp.category}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {exp.createdByName} · {relativeTime(exp.createdAt)}
            </p>
          </div>

          {/* Amount */}
          <p
            className="text-sm font-semibold tabular-nums flex-shrink-0"
            style={{ color: "var(--accent-red)" }}
          >
            {exp.currency === "USD" ? "US" : ""}
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: exp.currency === "USD" ? "USD" : "ARS",
              maximumFractionDigits: 0,
            }).format(exp.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}
