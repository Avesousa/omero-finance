"use client";

import { useState } from "react";
import type { CategoryRow, UserSummary } from "@/lib/dashboard";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface BudgetTableProps {
  categories: CategoryRow[];
  users: UserSummary[];
}

export function BudgetTable({ categories, users }: BudgetTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p
        className="text-xs font-medium uppercase tracking-widest px-1"
        style={{ color: "var(--text-secondary)" }}
      >
        Distribución del presupuesto
      </p>

      {categories.map((cat) => (
        <CategoryCard
          key={cat.key}
          category={cat}
          users={users}
          isExpanded={expanded === cat.key}
          onToggle={() => setExpanded(expanded === cat.key ? null : cat.key)}
        />
      ))}
    </div>
  );
}

interface CategoryCardProps {
  category: CategoryRow;
  users: UserSummary[];
  isExpanded: boolean;
  onToggle: () => void;
}

function CategoryCard({ category: cat, users, isExpanded, onToggle }: CategoryCardProps) {
  const usedPct = cat.budgetedArs > 0 ? Math.min(cat.usedArs / cat.budgetedArs, 1) : 0;
  const overPct = cat.budgetedArs > 0 ? Math.max((cat.usedArs - cat.budgetedArs) / cat.budgetedArs, 0) : 0;

  const barColor = cat.isOverspent
    ? "var(--accent-red)"
    : usedPct > 0.85
    ? "var(--accent-amber)"
    : "var(--accent-green)";

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: cat.isOverspent ? "var(--accent-red)" : "var(--border)",
      }}
    >
      {/* Main row — always visible */}
      <button
        className="w-full px-4 pt-4 pb-3 text-left"
        onClick={onToggle}
        type="button"
      >
        {/* Label + percentage + amounts */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {cat.label}
              </span>
              {cat.isAuto && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                >
                  auto
                </span>
              )}
              {cat.isOverspent && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "var(--accent-red)" }}
                >
                  sobregirado
                </span>
              )}
            </div>
            <span className="text-xs mt-0.5 block" style={{ color: "var(--text-secondary)" }}>
              {pct(cat.percentage)} del ingreso
            </span>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmt(cat.budgetedArs)}
            </p>
            <p
              className="text-xs tabular-nums"
              style={{ color: cat.isOverspent ? "var(--accent-red)" : "var(--text-secondary)" }}
            >
              {cat.availableArs >= 0 ? "disp. " : ""}
              {fmt(Math.abs(cat.availableArs))}
              {cat.availableArs < 0 ? " extra" : ""}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
          <div className="h-full flex">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${usedPct * 100}%`, backgroundColor: barColor }}
            />
            {overPct > 0 && (
              <div
                className="h-full"
                style={{ width: `${overPct * 100}%`, backgroundColor: "var(--accent-red)", opacity: 0.4 }}
              />
            )}
          </div>
        </div>

        <div className="flex justify-between mt-1">
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            Usado {fmt(cat.usedArs)}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {(usedPct * 100).toFixed(0)}%
          </span>
        </div>
      </button>

      {/* Expanded — per-user breakdown */}
      {isExpanded && (
        <div
          className="px-4 pb-4 pt-1 border-t space-y-3"
          style={{ borderColor: "var(--border)" }}
        >
          {users.map((u) => {
            const userRow = cat.perUser[u.id];
            if (!userRow) return null;
            const userUsedPct = userRow.budgeted > 0
              ? Math.min(userRow.used / userRow.budgeted, 1)
              : 0;

            return (
              <div key={u.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: u.avatarColor }}
                    >
                      {u.name[0]}
                    </div>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {u.name}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs tabular-nums">
                    <span style={{ color: "var(--text-secondary)" }}>
                      {fmt(userRow.budgeted)}
                    </span>
                    <span
                      style={{ color: userRow.available < 0 ? "var(--accent-red)" : "var(--accent-green)" }}
                    >
                      {fmt(userRow.available)} disp.
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-elevated)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${userUsedPct * 100}%`, backgroundColor: u.avatarColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
