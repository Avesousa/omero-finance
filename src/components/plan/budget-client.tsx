"use client";

import { useMemo, useState } from "react";
import {
  buildSummary, fmtArs, numberToInput, parseMoney, periodLabel, TDC_KEY,
} from "@/lib/plan/core";
import type { PlanData } from "@/lib/plan/server";
import { budgetMessage } from "./budget-rows";
import {
  ErrorText, ListCard, MoneyInput, NotStartedNotice, Pill, PlanHeader, PrimaryButton, ProgressBar,
  SectionTitle, SmallAction, TONE, api, cardStyle, useAction, withPeriod,
} from "./plan-ui";

export function BudgetClient({ data }: { data: PlanData }) {
  const action = useAction();
  const saved = useMemo(() => new Map(data.budgets.map((b) => [b.categoryId, b.amount])), [data.budgets]);

  // Solo se guarda en estado lo que se está editando; el resto sale de los datos.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const summary = useMemo(() => buildSummary(data), [data]);
  const rowBy = new Map(summary.rows.map((r) => [r.categoryId, r]));

  const categories = data.categories.filter(
    (c) => c.kind === "EXPENSE" && (!c.isArchived || saved.has(c.id) || rowBy.has(c.id)),
  );

  const textOf = (id: string) => drafts[id] ?? numberToInput(saved.get(id) ?? null);
  const valueOf = (id: string) => parseMoney(textOf(id)) || 0;

  const dirtyIds = Object.keys(drafts).filter((id) => valueOf(id) !== (saved.get(id) ?? 0));
  const dirty = dirtyIds.length > 0;
  const budgetTotal = categories.reduce((s, c) => s + valueOf(c.id), 0);
  const unassigned = summary.incomeArs - budgetTotal;

  function copyPrevious() {
    setDrafts(Object.fromEntries(data.previousBudgets.map((b) => [b.categoryId, numberToInput(b.amount)])));
  }

  function save() {
    return action.run(
      () => api("PUT", "/api/plan/budget", {
        period: data.period,
        items: dirtyIds.map((id) => ({ categoryId: id, amount: valueOf(id) })),
      }),
      () => setDrafts({}),
    );
  }

  return (
    <>
      <PlanHeader title="Presupuesto" period={data.period} backHref={withPeriod("/plan/mas", data.period)} />

      {!data.started ? (
        <NotStartedNotice period={data.period} />
      ) : (
        <>
          <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Ingresos del mes</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(summary.incomeArs)}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Presupuestado</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtArs(budgetTotal)}</p>
              </div>
            </div>
            <ProgressBar value={budgetTotal} max={summary.incomeArs} tone={unassigned < -0.5 ? TONE.over : "var(--accent)"} />
            <p className="text-xs" style={{ color: unassigned < -0.5 ? TONE.over : "var(--text-secondary)" }}>
              {unassigned < -0.5
                ? `Presupuestaste ${fmtArs(-unassigned)} más de lo que entra.`
                : unassigned > 0.5
                  ? <>Te quedan <strong className="tabular-nums" style={{ color: TONE.ok }}>{fmtArs(unassigned)}</strong> sin destino. Asignalos a ahorro o deudas.</>
                  : "Cada peso tiene destino."}
            </p>
          </div>

          <section className="space-y-2">
            <SectionTitle
              right={
                data.budgets.length === 0 && data.previousBudgets.length > 0 && !dirty
                  ? <SmallAction onClick={copyPrevious}>Copiar de {periodLabel(data.previousBudgetPeriod!)}</SmallAction>
                  : undefined
              }
            >
              Por categoría
            </SectionTitle>
            <ListCard>
              {categories.map((c) => {
                const row = rowBy.get(c.id);
                const budget = valueOf(c.id);
                const actual = row?.actual ?? 0;
                const over = budget > 0 && actual > budget + 0.005;
                const tone = over ? TONE.over : budget > 0 && actual >= budget * 0.85 ? TONE.near : TONE.ok;
                return (
                  <div key={c.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                          {over && <Pill tone="over">excedido</Pill>}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: over ? TONE.over : "var(--text-secondary)" }}>
                          {actual > 0 || budget > 0
                            ? <>Gastado {fmtArs(actual)}{budget > 0 && row && drafts[c.id] === undefined ? ` · ${budgetMessage(row).toLowerCase()}` : ""}</>
                            : c.systemKey === TDC_KEY ? "Se llena con los resúmenes" : "Sin movimientos"}
                        </p>
                      </div>
                      <div className="w-36 flex-shrink-0">
                        <MoneyInput
                          value={textOf(c.id)}
                          onChange={(text) => setDrafts((d) => ({ ...d, [c.id]: text }))}
                          ariaLabel={`Presupuesto de ${c.name}`}
                        />
                      </div>
                    </div>
                    {(actual > 0 || budget > 0) && <ProgressBar value={actual} max={budget} tone={tone} />}
                    {row && row.earmarked > 0 && (
                      <p className="text-[11px]" style={{ color: "var(--accent)" }}>
                        Ingresos destinados acá: {fmtArs(row.earmarked)}
                      </p>
                    )}
                  </div>
                );
              })}
            </ListCard>
            {rowBy.has(null) && (
              <p className="text-[11px] px-1" style={{ color: "var(--text-secondary)" }}>
                Además hay {fmtArs(rowBy.get(null)!.actual)} en gastos sin categoría.
              </p>
            )}
          </section>

          <ErrorText error={action.error} />

          {dirty && (
            <div
              className="sticky z-30"
              style={{ bottom: "max(7rem, calc(6rem + env(safe-area-inset-bottom)))" }}
            >
              <div className="rounded-2xl p-2" style={{ ...cardStyle, boxShadow: "var(--shadow-lg)" }}>
                <PrimaryButton onClick={save} busy={action.busy}>Guardar presupuesto</PrimaryButton>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
