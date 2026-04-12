"use client";

import type { DashboardData } from "@/lib/dashboard";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

interface DashboardClientProps {
  data: DashboardData;
}

export function DashboardClient({ data }: DashboardClientProps) {
  const { totalIncomeArs, surplusArs, categories } = data;

  const totalBudgeted = categories.reduce((s, c) => s + c.budgetedArs, 0);
  const totalSpent = categories.reduce((s, c) => s + c.usedArs, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Income summary */}
      <div
        className="rounded-2xl border p-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
            Ingresos del mes
          </p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {fmt(totalIncomeArs)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
            Sobrante
          </p>
          <p
            className="text-xl font-bold tabular-nums"
            style={{ color: surplusArs >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
          >
            {fmt(surplusArs)}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      <p
        className="text-xs font-medium uppercase tracking-widest px-1"
        style={{ color: "var(--text-secondary)" }}
      >
        Distribución por categoría
      </p>

      <div className="space-y-2">
        {categories.map((cat) => {
          const usedPct = cat.budgetedArs > 0 ? Math.min(cat.usedArs / cat.budgetedArs, 1) : 0;
          const isOver = cat.isOverspent;
          const barColor = isOver
            ? "var(--accent-red)"
            : usedPct > 0.85
            ? "var(--accent-amber)"
            : "var(--accent-green)";

          return (
            <div
              key={cat.key}
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: isOver ? "var(--accent-red)" : "var(--border)",
              }}
            >
              {/* Name + amounts */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {cat.label}
                    </span>
                    {cat.isAuto && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "var(--bg-elevated)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        auto
                      </span>
                    )}
                    {isOver && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{
                          backgroundColor: "rgba(239,68,68,0.15)",
                          color: "var(--accent-red)",
                        }}
                      >
                        sobregirado
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs mt-0.5 block"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Presupuesto: {fmt(cat.budgetedArs)}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className="text-sm font-bold tabular-nums"
                    style={{
                      color: isOver ? "var(--accent-red)" : "var(--text-primary)",
                    }}
                  >
                    {fmt(cat.usedArs)}
                  </p>
                  <p
                    className="text-xs tabular-nums"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {(usedPct * 100).toFixed(0)}% usado
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${usedPct * 100}%`, backgroundColor: barColor }}
                />
              </div>

              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  Gastado {fmt(cat.usedArs)}
                </span>
                <span
                  className="text-[10px]"
                  style={{
                    color: isOver ? "var(--accent-red)" : "var(--text-secondary)",
                  }}
                >
                  {cat.availableArs >= 0
                    ? `Disponible ${fmt(cat.availableArs)}`
                    : `${fmt(Math.abs(cat.availableArs))} extra`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals footer */}
      <div
        className="rounded-2xl border p-4 space-y-2"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <p
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          Totales
        </p>
        <div className="flex justify-between">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Total presupuestado
          </span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {fmt(totalBudgeted)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Total gastado
          </span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={{
              color: totalSpent > totalBudgeted ? "var(--accent-red)" : "var(--text-primary)",
            }}
          >
            {fmt(totalSpent)}
          </span>
        </div>
        <div
          className="border-t pt-2"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex justify-between">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Diferencia
            </span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{
                color:
                  totalBudgeted - totalSpent >= 0
                    ? "var(--accent-green)"
                    : "var(--accent-red)",
              }}
            >
              {fmt(totalBudgeted - totalSpent)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
