"use client";

import { useState } from "react";
import { ShoppingCart, Wrench, Zap, User } from "lucide-react";

export interface CardExpense {
  id: string;
  description: string;
  amount: number;
  currency: "ARS" | "USD";
  category: "mercado" | "general" | "fijo" | "personal";
  cardName: string;
  createdByName: string;
  createdAt: string;
}

const ICON: Record<string, React.ReactNode> = {
  mercado:  <ShoppingCart size={14} />,
  fijo:     <Wrench size={14} />,
  general:  <Zap size={14} />,
  personal: <User size={14} />,
};

function fmt(n: number, currency: "ARS" | "USD") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function relativeTime(iso: string) {
  const diff    = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ayer" : `hace ${days}d`;
}

interface CardExpensesProps {
  expenses: CardExpense[];
  cards: string[];
}

export function CardExpenses({ expenses, cards }: CardExpensesProps) {
  const [selected, setSelected] = useState<string | null>(cards[0] ?? null);

  const filtered = selected
    ? expenses.filter((e) => e.cardName === selected)
    : expenses;

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Card filter chips — horizontal scroll */}
      {cards.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {cards.map((c) => {
            const count = expenses.filter((e) => e.cardName === c).length;
            return (
              <button
                key={c}
                onClick={() => setSelected(c === selected ? null : c)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap"
                style={{
                  borderColor:     selected === c ? "var(--accent)" : "var(--border)",
                  backgroundColor: selected === c ? "rgba(99,102,241,0.12)" : "var(--bg-elevated)",
                  color:           selected === c ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {c}
                {count > 0 && (
                  <span
                    className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs"
                    style={{
                      backgroundColor: selected === c ? "var(--accent)" : "var(--bg-card)",
                      color: selected === c ? "var(--accent-foreground)" : "var(--text-secondary)",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Expense list */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl border py-12 flex flex-col items-center gap-2"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {cards.length === 0
              ? "Registrá gastos seleccionando una tarjeta en el formulario"
              : "Sin gastos registrados para esta tarjeta"}
          </p>
          <p className="text-xs max-w-[240px] text-center" style={{ color: "var(--text-secondary)" }}>
            Los gastos aparecen acá cuando elegís una tarjeta al registrar un gasto.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: "var(--bg-card)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                >
                  {ICON[e.category] ?? <Zap size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {e.description}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {e.createdByName} · {relativeTime(e.createdAt)}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--accent-red)" }}>
                  {fmt(e.amount, e.currency)}
                </p>
              </div>
            ))}
          </div>

          {/* Total */}
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: "var(--bg-elevated)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Total ({filtered.length} {filtered.length === 1 ? "gasto" : "gastos"})
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmt(total, "ARS")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
