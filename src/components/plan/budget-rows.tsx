"use client";

import { fmtArs, type BudgetRow } from "@/lib/plan/core";
import { Pill, ProgressBar, TONE } from "./plan-ui";

const STATUS_TONE = { ok: TONE.ok, near: TONE.near, over: TONE.over, unbudgeted: TONE.near, unused: TONE.muted } as const;

/** Texto corto que explica cómo viene una línea del presupuesto. */
export function budgetMessage(row: BudgetRow): string {
  switch (row.status) {
    case "over":
      return `Te pasaste ${fmtArs(-row.remaining)}`;
    case "near":
      return row.remaining < 0.5 ? "Justo en el tope" : `Quedan ${fmtArs(row.remaining)}`;
    case "ok":
      return `Quedan ${fmtArs(row.remaining)}`;
    case "unbudgeted":
      return "Sin presupuesto";
    case "unused":
      return "Sin presupuesto";
  }
}

/** Línea de presupuesto vs gasto real, con barra de avance. */
export function BudgetRowView({ row }: { row: BudgetRow }) {
  const tone = STATUS_TONE[row.status];
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{row.name}</span>
            {row.status === "over" && <Pill tone="over">excedido</Pill>}
            {row.status === "near" && <Pill tone="near">cerca del tope</Pill>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: row.status === "over" ? TONE.over : "var(--text-secondary)" }}>
            {budgetMessage(row)}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {fmtArs(row.actual)}
          </p>
          <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {row.budget > 0 ? `de ${fmtArs(row.budget)}` : "—"}
          </p>
        </div>
      </div>
      <ProgressBar value={row.actual} max={row.budget} tone={tone} />
      {row.earmarked > 0 && (
        <p className="text-[11px]" style={{ color: "var(--accent)" }}>
          Ingresos destinados acá: {fmtArs(row.earmarked)}
        </p>
      )}
    </div>
  );
}
