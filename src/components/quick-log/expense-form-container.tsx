"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import { ExpenseForm } from "./expense-form";
import { IncomeForm } from "./income-form";
import { RecentExpenses, type RecentExpense } from "./recent-expenses";
import { RecentIncomes, type RecentIncome } from "./recent-incomes";
import type { ViewMode } from "./home-client";
import { type CardItem } from "@/components/tdc/card-management";

export interface FixedTemplate {
  id: string;
  concept: string;
  amount: number;
  currency: "ARS" | "USD";
}

interface ExpenseFormContainerProps {
  mode: ViewMode;
  currentRate: number;
  userId: string;
  recentExpenses: RecentExpense[];
  myRecentExpenses: RecentExpense[];
  recentIncomes: RecentIncome[];
  fixedTemplates: FixedTemplate[];
  cards: CardItem[];
}

export function ExpenseFormContainer({ mode, currentRate, userId, recentExpenses, myRecentExpenses, recentIncomes, fixedTemplates, cards }: ExpenseFormContainerProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"gasto" | "ingreso">("gasto");

  async function handleExpense(
    data: Parameters<React.ComponentProps<typeof ExpenseForm>["onSubmit"]>[0]
  ) {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? "Error al guardar el gasto");
    }
    router.refresh();
  }

  async function handleIncome(
    data: Parameters<React.ComponentProps<typeof IncomeForm>["onSubmit"]>[0]
  ) {
    const res = await fetch("/api/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, isPersonal: data.isPersonal }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? "Error al guardar el ingreso");
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        <button
          onClick={() => setTab("gasto")}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: tab === "gasto" ? "var(--bg-card)" : "transparent",
            color:           tab === "gasto" ? "var(--text-primary)" : "var(--text-secondary)",
          }}
        >
          <TrendingDown size={14} />
          Gasto
        </button>
        <button
          onClick={() => setTab("ingreso")}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: tab === "ingreso" ? "var(--bg-card)" : "transparent",
            color:           tab === "ingreso" ? "var(--accent-green)" : "var(--text-secondary)",
          }}
        >
          <TrendingUp size={14} />
          Ingreso
        </button>
      </div>

      {/* Form */}
      {tab === "gasto"
        ? <ExpenseForm currentRate={currentRate} fixedTemplates={fixedTemplates} userId={userId} cards={cards} onSubmit={handleExpense} />
        : <IncomeForm  currentRate={currentRate} userId={userId} onSubmit={handleIncome} />
      }

      {/* Recent activity */}
      <section>
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3 px-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {tab === "gasto" ? "Últimos gastos" : "Últimos ingresos"}
        </h2>
        {tab === "gasto"
          ? <RecentExpenses expenses={mode === "personal" ? myRecentExpenses : recentExpenses} />
          : <RecentIncomes  incomes={recentIncomes} />
        }
      </section>
    </div>
  );
}
